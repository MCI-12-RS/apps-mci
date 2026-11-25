# E1.04: Função de login `sign-in`

> Status: Negócio, Experiência (UX), Solução técnica e Tarefas prontos (2026-11-23), sem perguntas em aberto. A implementação começa depois do PR 1 do E2.01 em produção. Ficam para o usuário revisar no PR: os padrões P-LOG-01 a P-LOG-16, a DT-01 (caminho único com o provedor de e-mail e senha do Auth desligado) e as DA-1 a DA-13, definidas pelo `architect`. Falta só a seção Testes.
> **Nota de 2026-11-24 (E2.03):** o desenho do [E2.03](e2-03-senha.md) (DT-01) tira a senha do Supabase Auth e a guarda no cofre `private.account_passwords`, com um trigger em `auth.users` recusando senha gravada pelo Auth. Ao implementar o E1.04, o `architect` decide se a `sign_in_attempt` já nasce lendo o cofre (evita migrar duas vezes) ou se o E2.03 faz essa troca, como está desenhado lá.
> **Implantação (2026-11-25):**
> - PR 1 (mci-connect#24) e PR 1b (#25) aplicados pelo "Deploy: banco". Passo A feito (`security_sb_forwarded_for_enabled = true`, `rate_limit_verify = 150`).
> - PR 2 (#26) mergeado e promovido (`216663f`): o domínio serve a tela que chama a `sign-in`. Passo B feito (`external_email_enabled = false`).
> - *Smoke* de produção, com uma conta temporária só no Auth (sem membro, apagada depois): `generate_link` + `/verify` com a chave secreta e `Sb-Forwarded-For` dão 200 antes e depois do passo B; a renovação funciona; o login direto por senha dá 422 `email_provider_disabled`; o `admin.createUser` continua funcionando. Pela `sign-in`: 401 para identificação inexistente e para inválida, com `login_failed` na Auditoria (máscaras `s***@example.invalid` e `***`, sem a origem).
> - **Não feito em produção:** o login com sucesso pela `sign-in` completa (com cadastro de membro). Não há conta de teste de membro em produção (as 5 contas são de pessoas reais) e o critério de pronto 6 proíbe usar conta real. O caminho completo está coberto só na stack local (tarefa 7, `e2e/sign-in-stack.spec.ts`). Criar uma conta de teste de membro em produção fica como decisão do usuário.
> - PR 3 (#27): tarefas 8 e 9 (parte local). Falta o merge, o "Deploy: banco" e o *smoke* da tarefa 9.
> - Revisão final (tarefa 10, 2026-11-25): **APROVADO**. `CLAUDE.md` e E2.01 (DT-14, T21 e T23) atualizados. Ficam para depois, fora do E1.04: a role de id fixo e a massa de paginação no e2e (`qa`); contraste do `--primary` no escuro, anel de foco do bloqueio e linha da Auditoria pelo teclado (`frontend-developer`); paginação da Auditoria e retenção das falhas (risco 5, PO).
>
> Slug: `e1-04-sign-in` · Paridade com o legado: sim (AUT-01, DEL-06), com regras novas: login por CPF (D5), celular escrito de qualquer jeito, resposta única, limite de tentativas e registro das falhas na Auditoria.

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-23 a partir destas fontes:_
- _o passo E1.04 e a seção 6.3 do [`docs/migracao.md`](../migracao.md);_
- _as decisões D1, D5, D6, D7 e D11;_
- _as decisões de login do [`e2-01-exclusao-logica.md`](e2-01-exclusao-logica.md): RN-14, P-DEL-21, DT-13 e DT-14;_
- _o código do legado;_
- _o estado do `mci-connect` no commit `14ee75f`._

_Atualizada no mesmo dia com as decisões do PO sobre as pendências PO-UX-1 a PO-UX-6 da seção Experiência (UX) (P-LOG-13 a P-LOG-16)._

### Contexto e objetivo
**No legado**, a pessoa entra com o e-mail ou o celular e a senha:
- o e-mail é comparado sem diferenciar maiúsculas;
- o celular é comparado só com dígitos, que é como ele é gravado;
- os espaços antes e depois da identificação são ignorados, e a senha vai como foi digitada;
- só cadastros não excluídos são encontrados, e inativos entram normalmente;
- campo vazio tem mensagem própria.

**No novo, hoje** (conferido em 2026-11-23):
- A tela tem o campo "Identificação" (dica: "CPF, celular ou e-mail"). Enquanto a pessoa digita, ela mostra se reconheceu um CPF, um celular ou um e-mail, mas só reconhece números de 11 dígitos.
- **Com e-mail,** o app chama o login do Supabase Auth direto, com o e-mail digitado. Esse é o e-mail da conta de acesso, que não muda quando o e-mail do cadastro é trocado.
- **Com CPF ou celular,** o app chama antes a função `get-user-email`.
  - Ela é pública e devolve o e-mail do cadastro para qualquer CPF ou celular. Assim, qualquer pessoa que conheça o CPF ou o celular de alguém descobre o e-mail dessa pessoa.
  - Quando mais de um cadastro combina, ela devolve um deles, sem critério.
- **Mensagens de erro:** o texto muda conforme o caso ("CPF ou celular não encontrado ou não vinculado a um e-mail.", ou o texto em inglês do Auth) e aparece num aviso que some sozinho.
- **Limite de tentativas:** não há um próprio. Só valem os limites gerais do Auth por endereço de rede.
- **Auditoria:** o próprio app registra o login com sucesso. As falhas deixaram de ser registradas no E1.13, que passou esse registro para este passo.

**Objetivo do passo:**
- trocar a `get-user-email` pela função de login `sign-in`, que recebe a identificação e a senha, faz o login no servidor e devolve só a sessão;
- aceitar e-mail real, celular e CPF (D5), com ou sem máscara;
- responder do mesmo jeito, e no mesmo tempo, a qualquer falha, sem revelar se o cadastro existe (6.3; RN-14 do E2.01);
- limitar as tentativas por identificação e por origem;
- registrar na Auditoria, pelo servidor, o login, a falha e o bloqueio por excesso de tentativas;
- deixar pronto o ponto onde o E3.02 vai conferir a senha do legado na primeira entrada.

A fase 3 (Contas e senhas) só começa depois deste passo.

### Termos
- **Identificação:** o que a pessoa digita no primeiro campo do login: e-mail, celular ou CPF.
- **Cadastro:** o registro do membro em Membros.
- **Conta de acesso:** a conta no Supabase Auth ligada ao cadastro. É nela que fica a senha.
- **E-mail fictício:** o e-mail gerado para quem não tem e-mail, porque a conta de acesso exige um.
  - Hoje o domínio é `@mci12fakemail.com`. Depois do E1.06, passa a ser o domínio da D7.
  - O e-mail fictício não pertence a ninguém e não aparece nas telas.
- **Conta suspensa:** a conta de acesso de um membro excluído (RN-14 e DT-13 do E2.01). A senha fica vazia e a conta fica banida. Ela volta a funcionar quando o cadastro é restaurado.
- **Falha de credencial:** qualquer tentativa que chega à função, com a identificação e a senha preenchidas, e não termina em login. Ficam de fora as tentativas recusadas por bloqueio e os erros do servidor (RN-08). O que a tela barra antes de enviar (campos vazios ou formato não reconhecido) nem chega à função.
- **Bloqueio por tentativas:** impedimento temporário de tentar entrar, depois de muitas falhas.
  - Não muda o cadastro, a conta nem a senha, e termina sozinho.
  - Não é a mesma coisa que a conta suspensa.
- **Origem:** o endereço de rede (IP) de onde a tentativa chega à função.
- **Credencial legada:** o MD5 da senha do legado, guardado para a primeira entrada no novo (6.3). Só passa a existir com o E3.01 e o E3.02.
- **Mensagem única:** "Usuário ou senha inválidos. Confira os dados e tente de novo." (P-DEL-21).

Os prazos deste spec contam em minutos corridos e não dependem do dia nem da semana.

### Personas e permissões
Entrar não depende de permissão. Depois do login, o que cada pessoa vê segue as permissões e o escopo, que não mudam neste passo.

| Persona | Quem é | Neste spec |
|---|---|---|
| VI Quem tenta entrar | qualquer pessoa sem sessão, pela tela ou chamando a função direto com a chave pública | tenta entrar e nunca descobre se um cadastro existe |
| MB Membro com conta | cadastro não excluído, com conta de acesso | entra com o e-mail real, o celular ou o CPF |
| IN Membro inativo | cadastro com a situação Inativo | entra, como no legado |
| PA Pastor | topo da árvore, sem líder (`is_pastor`) | entra como qualquer membro |
| SF Membro sem permissões | função sem nenhuma permissão, ou cadastro sem função | entra; as telas seguem as permissões |
| X Membro excluído | cadastro excluído, com a conta suspensa (E2.01) | não entra |
| SC Membro sem conta | cadastro sem conta de acesso (por exemplo, migrado sem e-mail e sem celular, 6.2) | não entra |
| AU Quem audita | quem tem `view_audit_log`. Hoje as migrations concedem essa permissão a quem tem "Gerenciar Funções", e ela não aparece na tela de Funções | vê logins, falhas e bloqueios na Auditoria |

### Histórias
- Como membro, quero entrar com o e-mail, o celular ou o CPF, escritos do jeito que eu costumo escrever, para não precisar lembrar um formato exato.
- Como membro que vem do sistema antigo, quero entrar com a mesma identificação de sempre. A senha antiga chega no E3.02.
- Como igreja, quero que ninguém descubra pela tela de login se uma pessoa tem cadastro, nem o e-mail dela a partir do CPF ou do celular, para proteger os dados dos membros (LGPD).
- Como igreja, quero limitar as tentativas de adivinhar senhas, para proteger as contas.
- Como quem audita, quero ver os logins, as falhas e os bloqueios, para perceber tentativas de invasão.
- Como membro que errou a senha muitas vezes, quero saber quanto tempo esperar e o que fazer se esqueci a senha.

### Decisões

#### Decisões do usuário e de passos anteriores
| Decisão | O que vale aqui | Onde |
|---|---|---|
| D5 (2026-11-23) | A identificação pode ser o e-mail real, o celular ou o CPF, e cada um é único. | RN-01 a RN-05 |
| D1 (2026-11-14) e RN-14 do E2.01 | O membro excluído não entra, e a mensagem é a mesma de qualquer outra falha. | RN-06, RN-07 |
| P-DEL-21 (E2.01) | A mensagem única e a mensagem de falha de conexão. | RN-07, RN-08 |
| DT-13 (E2.01) | A conta do membro excluído fica suspensa: senha vazia e conta banida. | RN-06, RN-07 |
| DT-14 (E2.01) | Até este passo, a `get-user-email` ignora os excluídos. | RN-16 |
| D6 (2026-11-23) | A senha antiga não tem prazo. Isso vale para o E3.02, que usa o ponto preparado aqui. | RN-17 |
| D7 (2026-11-23) | O domínio dos e-mails fictícios vai mudar (E1.06). Nenhum dos dois domínios serve para entrar. | RN-01 |
| D11 (2026-11-15) | A senha inicial `123456` continua valendo. | RN-17 |
| 6.3 do `docs/migracao.md` | A função `sign-in` substitui a `get-user-email`, devolve a sessão e responde só "Usuário ou senha inválidos". O limite é por identificação e por origem, e nada de senha ou dado pessoal vai para os logs. | RN-07, RN-09 a RN-11, RN-13, RN-15 |

#### Padrões definidos por este spec (revisar no PR)
Estes pontos não estão nas fontes. O PO adotou a opção mais conservadora e coerente com o legado e com o E2.01. Nas regras, eles aparecem como "definida pelo spec", e o usuário pode mudar qualquer um na revisão do PR.

- **P-LOG-01, a identificação vem do cadastro.** O login procura o e-mail, o celular e o CPF no cadastro do membro e entra na conta de acesso ligada a ele.
  - O e-mail antigo que só ficou na conta de acesso, depois de uma troca no cadastro, não serve mais.
  - O e-mail fictício não serve, porque a D5 fala em "e-mail real" (RN-01).
- **P-LOG-02, celular escrito de qualquer jeito.** São aceitos (RN-03):
  - com ou sem máscara;
  - com ou sem o 55 do Brasil, só quando o número tem 12 ou 13 dígitos, porque 55 também é DDD no RS;
  - com ou sem zeros à esquerda;
  - com ou sem o 9º dígito.

  Quando o número bate exatamente com um cadastro, ele tem preferência sobre um que só bate pela regra do 9º dígito.
- **P-LOG-03, ambiguidade.** Se a identificação leva a mais de um cadastro, a tentativa falha com a mensagem única e fica registrada na Auditoria. O sistema não tenta descobrir pela senha qual dos cadastros é o certo (RN-05).
- **P-LOG-04, tempo igual.** As falhas não podem ser distinguidas pelo tempo de resposta: em 20 tentativas de cada caso, a mediana de cada caso fica a menos de 100 ms da mediana de "senha errada" (RN-07).
- **P-LOG-05, limite por identificação** (RN-10):
  - 5 falhas em 15 minutos bloqueiam a identificação por 15 minutos;
  - vale também para identificações que não existem;
  - a 5ª falha já mostra a mensagem de bloqueio;
  - tentar durante o bloqueio não aumenta o bloqueio;
  - um login com sucesso zera a contagem;
  - as outras identificações do mesmo membro continuam livres.
- **P-LOG-06, limite por origem** (RN-11):
  - 50 falhas em 15 minutos bloqueiam a origem por 15 minutos (eram 20; o usuário subiu para 50 em 2026-11-24, risco 16);
  - um login com sucesso não zera a contagem.

  É o padrão mais sensível. A rede Wi-Fi da igreja e as operadoras de celular que dividem o mesmo endereço entre muitos clientes podem juntar várias pessoas numa origem só.
- **P-LOG-07, fim do bloqueio.** Não há desbloqueio manual, nem por administrador: o bloqueio termina sozinho. A mensagem orienta a falar com o líder em caso de senha esquecida, como a seção 6.7 prevê (RN-12).
- **P-LOG-08, caminho único.** Entrar com senha direto no Auth, sem passar pela `sign-in`, é recusado. Sem isso, o limite e a Auditoria poderiam ser contornados (RN-14).
- **P-LOG-09, privacidade na Auditoria** (RN-11, RN-15):
  - a origem não vai para a Auditoria e fica guardada no máximo 24 horas;
  - cada bloqueio gera um evento só;
  - o motivo da falha fica visível para quem audita.
- **P-LOG-10, saída da `get-user-email`.** Ela é apagada logo depois do promote do app novo e do teste de login. Um rollback do app não a publica de novo (RN-16).
- **P-LOG-11, textos novos** (RN-08, RN-12):
  - "Informe a identificação e a senha." para campos vazios;
  - a mensagem de bloqueio, com "Se esqueceu a senha, fale com o seu líder.";
  - o erro do servidor usa o mesmo texto da falha de conexão.
- **P-LOG-12, falhas internas** (RN-10, RN-11, RN-15):
  - se a contagem de tentativas falhar, a tentativa é recusada;
  - se o registro na Auditoria falhar, a resposta ao usuário não muda.
- **Vindos do desenho de UX (2026-11-23, PO-UX-1 a PO-UX-6 em "Experiência (UX)"):**
  - **P-LOG-13, o que conta como vazio** (PO-UX-4). A identificação só com espaços conta como vazia, porque as pontas são ignoradas (RN-02). A senha só com espaços não conta como vazia, porque é usada como foi digitada (RN-09). Vale na tela e pela API (RN-08).
  - **P-LOG-14, aviso de formato antes de enviar** (PO-UX-6). Quando a identificação não tem "@" e não tem a forma de um celular nem de um CPF (por exemplo, o celular sem DDD), a tela pede para conferir a identificação e não envia nada. Por isso, nada conta para o limite. Pela API, a mesma identificação continua sendo uma falha de credencial que conta para o limite (RN-07 a, RN-08). O aviso olha só o formato e não revela nada sobre os cadastros.
  - **P-LOG-15, tipo de identificação na Auditoria** (PO-UX-5). Além de E-mail, Celular e CPF, existe o tipo "CPF ou celular". Ele aparece quando o número foi procurado como os dois e não ficou claro por qual dos dois caminhos ele levou ao cadastro. Em "Identificação inválida", não há tipo (RN-15).
  - **P-LOG-16, CPF com todos os dígitos iguais** (AQ-3 da UX). Ele não é válido, como no legado (RN-04).
  - As decisões de tela (bloqueio sem contagem regressiva, "CPF ou celular" no indicador e "Mostrar senha") não mudam regra. Elas estão em "Pendências para o PO".

### Regras de negócio
Nenhuma regra está "a confirmar". Os caminhos do legado são relativos a `g12app-net/` e usam as mesmas abreviações do E2.01:
- `App/` = `G12App.Application/`;
- `Domain/` = `G12App.Domain/`;
- `Infra/` = `G12App.Infrastructure.Data/`;
- `UI/` = `G12App.API/ClientApp/src/`.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Identificações aceitas.** A pessoa entra com uma destas identificações do próprio cadastro, mais a senha:<br>- o e-mail real;<br>- o celular;<br>- o CPF.<br><br>Como funciona:<br>- A identificação é procurada no cadastro do membro, e o login entra na conta de acesso ligada a esse cadastro. Por isso, vale o e-mail atual do cadastro, mesmo que a conta de acesso ainda tenha um e-mail antigo. O e-mail antigo que só ficou na conta não serve.<br>- O e-mail fictício não serve, nem o domínio atual nem o da D7. Ele é tratado como identificação não encontrada.<br>- Os cadastros excluídos são ignorados (RN-06). | AUT-01; D5; legado (`Domain/Extensions/QueryingExtensions.cs:61-62`: e-mail ou celular; `App/Services/AuthService.cs:50-60`); CPF: D5; "do cadastro" e e-mail fictício: definida pelo spec (P-LOG-01) |
| RN-02 | **E-mail.** Uma identificação com "@" é tratada só como e-mail.<br>- Os espaços antes e depois são ignorados.<br>- Maiúsculas e minúsculas não fazem diferença.<br>- Fora isso, o e-mail precisa ser igual ao do cadastro. | legado (`Domain/Extensions/QueryingExtensions.cs:62`, `ToLower`; `UI/pages/Login/index.js:39`, `trim`); MEM-03 (e-mail único sem diferenciar maiúsculas) |
| RN-03 | **Celular.** Uma identificação sem "@" é lida só pelos dígitos: espaços, parênteses, hífens, pontos e o sinal "+" são ignorados.<br><br>Para comparar como celular:<br>(a) os zeros à esquerda são ignorados;<br>(b) com 12 ou 13 dígitos começando por 55, o 55 do Brasil é ignorado. Com 10 ou 11 dígitos, o 55 inicial é o DDD (Santa Maria, RS) e fica;<br>(c) o que sobra precisa ter 10 ou 11 dígitos (DDD e número). Senão, a identificação não é um celular;<br>(d) o celular do cadastro passa pela mesma leitura, e a correspondência exata vale primeiro;<br>(e) só quando nenhum cadastro bate exatamente, um número de 11 dígitos com 9 depois do DDD equivale ao mesmo número de 10 dígitos sem esse 9, e vice-versa (9º dígito). | celular só com dígitos: legado (`UI/pages/Members/details.js:225`) e 5.5 do `docs/migracao.md`; 55, zeros e 9º dígito: definida pelo spec (P-LOG-02) |
| RN-04 | **CPF.** Uma identificação sem "@" também é procurada como CPF quando tem exatamente 11 dígitos, contando os zeros à esquerda, e dígitos verificadores válidos.<br>- Pontos, hífen e espaços são ignorados.<br>- Um CPF com os 11 dígitos iguais (por exemplo, 111.111.111-11) não é válido.<br>- Um número que não é um CPF válido não é procurado como CPF; ele ainda pode ser um celular (RN-03). | D5; MEM-04 (CPF válido); MEM-05 (CPF único); dígitos iguais: legado (`UI/shared/utils.js:195-216`, `ValidateCPF`) e P-LOG-16 |
| RN-05 | **Ambiguidade.** O resultado da busca decide a tentativa:<br>- Se a identificação leva a um único cadastro, a tentativa segue. Isso vale também quando o CPF e o celular são do mesmo cadastro.<br>- Se ela leva a mais de um cadastro (por exemplo, o CPF de um e o celular de outro, ou o mesmo celular em dois cadastros antes da unicidade do E2.04), a tentativa falha com a mensagem única (RN-07). O sistema não tenta descobrir pela senha qual cadastro é o certo.<br>- A Auditoria registra o motivo "Identificação ambígua" (RN-15), para que a liderança corrija os cadastros.<br>- Os cadastros excluídos não contam para a ambiguidade. | D5 (cada identificação é única); conduta: definida pelo spec (P-LOG-03) |
| RN-06 | **Quem entra.** A pessoa entra quando:<br>(a) a identificação leva a um único cadastro não excluído (RN-01 a RN-05);<br>(b) esse cadastro tem uma conta de acesso que existe e está disponível: não está suspensa, não está banida e tem o e-mail confirmado;<br>(c) a senha confere (RN-09).<br><br>Nada mais é exigido:<br>- o membro **inativo** entra, como no legado;<br>- o pastor, o membro sem líder e o membro sem função ou sem permissões também entram;<br>- o que cada um vê depois segue as permissões e o escopo, que não mudam neste passo.<br><br>O membro excluído e o membro sem conta de acesso não entram. | legado (`Infra/Repositories/MemberRepository.cs:44-50`: só não excluídos, sem filtro de inativo; `App/Services/AuthService.cs:50-66`); 6.2 ("o status ativo/inativo não importa"); DEL-06; RN-14 do E2.01 |
| RN-07 | **Resposta única.** Todas estas falhas recebem a mesma resposta, com a mensagem única:<br>(a) identificação que não é e-mail, celular nem CPF. Pela tela, ela é barrada antes de enviar (RN-08); a falha (a) só acontece pela API;<br>(b) identificação não encontrada, inclusive o e-mail fictício e o e-mail antigo da conta;<br>(c) identificação ambígua (RN-05);<br>(d) cadastro excluído;<br>(e) cadastro sem conta de acesso;<br>(f) conta de acesso indisponível: suspensa, banida, com o e-mail não confirmado ou apagada do Auth;<br>(g) senha errada;<br>(h) depois do E3.02, a senha do legado que não confere.<br><br>"Mesma resposta" quer dizer:<br>- o mesmo código e o mesmo conteúdo;<br>- nenhum dado do cadastro;<br>- o mesmo tempo: em 20 tentativas de cada caso, medidas no mesmo ambiente, a mediana de cada caso fica a menos de 100 ms da mediana de "senha errada".<br><br>O motivo verdadeiro vai só para a Auditoria (RN-15). | 6.3, item 5 ("sem revelar se o usuário existe"); RN-14 e P-DEL-21 do E2.01; tempo: E2.01 (AQ-10, leitura técnica 4) e definida pelo spec (P-LOG-04) |
| RN-08 | **Outras respostas.** Nenhuma delas revela algo sobre o cadastro.<br>- **Campos vazios** (identificação ou senha): "Informe a identificação e a senha.".<br>  - A identificação só com espaços conta como vazia. A senha só com espaços não conta como vazia e é enviada (RN-09).<br>  - A tela confere antes de enviar. Pela API, a resposta é a mesma, a tentativa não conta e nada é registrado.<br>- **Formato não reconhecido:** "Confira a identificação: use o CPF, o celular com DDD ou o e-mail.".<br>  - Vale quando a identificação não tem "@" e não tem a forma de um celular (itens a, b e c da RN-03) nem de um CPF válido (RN-04), como o celular sem DDD.<br>  - A tela confere ao tocar em "Entrar" e não envia nada: a tentativa não conta para o limite e não é registrada.<br>  - Pela API, a mesma identificação é a falha (a) da RN-07: recebe a mensagem única e conta para o limite.<br>  - Uma identificação com "@" sempre é enviada.<br>- **Falha de conexão ou erro do servidor:** "Não foi possível entrar. Verifique a conexão e tente de novo.". Não conta como tentativa.<br>- Um erro que só acontece com um cadastro específico (por exemplo, a conta de acesso dele não pode ser lida) é tratado como falha de credencial (RN-07), e não como erro do servidor.<br>- **Bloqueio:** ver RN-12. | conexão: P-DEL-21 do E2.01; campos vazios: legado (`App/Services/AuthService.cs:47-48`); textos e erro do servidor: definida pelo spec (P-LOG-11); o que conta como vazio e aviso de formato: definida pelo spec (P-LOG-13, P-LOG-14, PO-UX-4 e PO-UX-6) |
| RN-09 | **A senha.**<br>- Ela é usada exatamente como foi digitada: espaços, maiúsculas e acentos são mantidos.<br>- O app envia a senha à função pela conexão segura (HTTPS) e não a transforma no navegador. No E3.02, o MD5 do legado vai ser calculado no servidor (6.3).<br>- A senha nunca é gravada, registrada nem devolvida pela função: não vai para logs, para a Auditoria nem para a tabela de tentativas. | legado (`UI/pages/Login/index.js:38-41`: o `trim` é só na identificação); 6.3 (Controles: "nada de senha, hash ou dado pessoal em log"; alternativa descartada de enviar o MD5) |
| RN-10 | **Limite por identificação.**<br>- 5 falhas de credencial com a mesma identificação em até 15 minutos, sem um login com sucesso entre elas, bloqueiam essa identificação por 15 minutos, contados da 5ª falha.<br>- A 5ª falha já responde com a mensagem de bloqueio (RN-12).<br><br>O que conta como a mesma identificação:<br>- as formas que as RN-02 a RN-04 tratam como iguais: máscara, 55, zeros à esquerda, 9º dígito e maiúsculas.<br>- Vale para qualquer identificação, exista ou não um cadastro com ela, para que o bloqueio não revele nada.<br><br>Durante o bloqueio:<br>- a senha não é conferida, nem se estiver certa;<br>- a tentativa recebe a mensagem de bloqueio e não estende o bloqueio;<br>- o bloqueio vale só para aquela identificação: o mesmo membro pode entrar com outra identificação dele, se a origem não estiver bloqueada.<br><br>Mais regras:<br>- Um login com sucesso zera a contagem da identificação.<br>- Tentativas simultâneas não passam do limite: de 20 tentativas erradas enviadas ao mesmo tempo com a mesma identificação, no máximo 5 têm a senha conferida.<br>- Se não for possível contar a tentativa, ela é recusada como erro do servidor (RN-08), sem conferir a senha. | E1.04 e 6.3 ("limite de tentativas por identificador e por IP, com bloqueio temporário"); números e demais detalhes: definida pelo spec (P-LOG-05, P-LOG-12) |
| RN-11 | **Limite por origem.**<br>- 50 falhas de credencial vindas da mesma origem em até 15 minutos, com qualquer identificação, bloqueiam essa origem por 15 minutos, contados da 50ª falha (decisão do usuário em 2026-11-24, risco 16; o desenho original tinha 20).<br>- Durante o bloqueio, nenhuma tentativa dessa origem tem a senha conferida, com qualquer identificação. Todas recebem a mensagem de bloqueio e não estendem o bloqueio.<br>- Um login com sucesso não zera a contagem da origem. Senão, bastaria entrar com a própria conta para continuar tentando nas contas dos outros.<br>- As tentativas simultâneas e a falha na contagem seguem a RN-10.<br>- A origem fica guardada só enquanto o controle precisar dela, no máximo 24 horas, e não vai para a Auditoria (RN-15). | E1.04 e 6.3; números, sucesso que não zera e guarda da origem: definida pelo spec (P-LOG-06, P-LOG-09) |
| RN-12 | **Mensagem e fim do bloqueio.**<br>- Mensagem: "Muitas tentativas sem sucesso. Aguarde {N} minutos e tente de novo. Se esqueceu a senha, fale com o seu líder.".<br>- {N} são os minutos que faltam, arredondados para cima, com "1 minuto" no singular. Se a identificação e a origem estão bloqueadas, vale o maior prazo.<br>- A mensagem é a mesma para o bloqueio por identificação e por origem, exista ou não o cadastro.<br>- O bloqueio termina sozinho. Não há desbloqueio manual neste passo, nem por administrador.<br>- O bloqueio não muda o cadastro, a conta nem a senha, e não encerra as sessões já abertas.<br>- Depois que o bloqueio termina, a contagem recomeça do zero. | 6.3 ("bloqueio temporário"); 6.7 (o caminho é falar com o próprio líder); texto e fim: definida pelo spec (P-LOG-07, P-LOG-11) |
| RN-13 | **Login com sucesso.**<br>- A função devolve só a sessão de quem entrou. Antes do login, nenhuma resposta da função traz o e-mail nem qualquer dado de cadastro.<br>- O app usa a sessão como hoje: a pessoa continua conectada, o acesso é renovado e ela pode sair.<br>- Quem já estiver conectado quando este passo for publicado continua conectado. | E1.04; 6.3, item 4 ("devolve a sessão"); seção 2 e "Problemas conhecidos" do `CLAUDE.md` (a `get-user-email` devolve o e-mail de qualquer CPF ou celular); sessões abertas: definida pelo spec |
| RN-14 | **Caminho único.**<br>- O app só entra pela `sign-in`. Ele não chama mais o login do Auth direto nem a `get-user-email`.<br>- Pela API, entrar com e-mail e senha direto no Auth, com a chave pública, é recusado, mesmo com a senha certa. Assim, os limites (RN-10, RN-11) e a Auditoria (RN-15) não podem ser contornados.<br>- A regra não vale para o que não confere senha: a renovação de uma sessão aberta, a saída e, quando existir, a recuperação de senha por e-mail (E1.07). | consequência das RN-10, RN-11 e RN-15; definida pelo spec (P-LOG-08) |
| RN-15 | **Auditoria.** Tudo é registrado pelo servidor.<br>(a) **Login realizado:** um registro por login, com quem entrou, quando, o tipo de identificação e a identificação mascarada, como hoje. O app deixa de registrar o login.<br>(b) **Falha no login:** um registro por falha de credencial (RN-07), com quando, o tipo e a identificação mascarada (quando houver) e o motivo, conforme os Textos de tela.<br>- **Tipo de identificação:**<br>  - E-mail, para uma identificação com "@";<br>  - Celular ou CPF, quando só um dos dois caminhos levou a um cadastro, ou quando o número só podia ser um deles;<br>  - "CPF ou celular", quando o número foi procurado como os dois e os dois levaram a algum cadastro (o mesmo ou cadastros diferentes) ou nenhum levou;<br>  - sem tipo, em "Identificação inválida". Quando a identificação leva a um único cadastro, mesmo excluído, o registro fica ligado a ele.<br>(c) **Bloqueio:** um registro quando o bloqueio começa, com quando, o tipo do bloqueio (por identificação ou por origem), a identificação mascarada (no bloqueio por identificação) e a duração. As tentativas recusadas durante o bloqueio não geram um registro cada.<br>(d) Nunca vão para a Auditoria nem para os logs da função: a senha, qualquer hash dela, a identificação completa e a origem.<br>(e) A saída continua sendo registrada como hoje.<br>(f) Só quem tem `view_audit_log` vê esses registros, como hoje.<br>(g) Se o registro falhar, a resposta ao usuário não muda. | 6.3 (Controles); E1.13 (as falhas passam a ser registradas no servidor no E1.04: `mci-connect/supabase/migrations/20261115000000_e113_audit_and_member_visibility.sql:8-10`); bloqueio, ligação ao cadastro e falha no registro: definida pelo spec (P-LOG-09, P-LOG-12); tipo "CPF ou celular": definida pelo spec (P-LOG-15, PO-UX-5) |
| RN-16 | **Fim da `get-user-email`.**<br>- Ela é apagada do projeto de produção, e não só tirada da lista de publicação. Isso acontece neste passo, logo depois que o app que usa a `sign-in` estiver no ar (promote) e o teste de login passar.<br>- Depois disso, chamar a `get-user-email` não devolve e-mail nem nenhum outro dado.<br>- O E1.04 só é aceito com a função fora do ar.<br>- Até lá, ela continua como está, com o filtro de excluídos da DT-14 se o E2.01 vier antes.<br>- Um rollback do app para uma versão anterior a este passo não publica a função de novo. Nesse caso, o login por CPF e celular fica indisponível até o app voltar para a versão com a `sign-in`. | E1.04; seção 2 do `docs/migracao.md` ("parar de devolver o e-mail de qualquer CPF ou celular"); momento e rollback: definida pelo spec (P-LOG-10) |
| RN-17 | **Senhas atuais e o ponto para o E3.02.**<br><br>Neste passo, a única senha conferida é a da conta de acesso:<br>- as senhas atuais continuam valendo, inclusive a inicial `123456` (D11);<br>- o login não aplica nenhuma regra de força de senha.<br><br>Fica pronto para o E3.02:<br>(a) a identificação leva ao cadastro (RN-01), que é a chave da credencial legada (6.3);<br>(b) existe um ponto, antes da conferência da senha da conta, onde o E3.02 vai conferir a credencial legada. Neste passo ele não faz nada;<br>(c) qualquer conferência de senha que vier depois herda, sem mudança, a resposta única, o tempo igual (RN-07), os limites (RN-10, RN-11), o caminho único (RN-14) e a Auditoria (RN-15);<br>(d) o app recebe a sessão da função (RN-13), então o E3.02 não muda o app, a não ser pela tela de troca obrigatória de senha;<br>(e) a senha chega à função como foi digitada (RN-09), que é o que o E3.02 precisa para calcular o MD5.<br><br>Ficam para o E3.01, o E3.02 e o E2.03:<br>- a credencial legada e a conferência do MD5;<br>- a política de senha;<br>- a marca de troca obrigatória (`must_change_password`) e a tela de troca. | E1.04 ("a parte da senha legada fica para o E3.02"); 6.3; E3.02; D6; D11; o que fica pronto: definida pelo spec |

### Critérios de aceite
Convenções:
- "Pela API" é qualquer chamada feita fora da tela, à função ou ao Auth, com a chave pública.
- "Mensagem única" e "mensagem de bloqueio" são os textos das RN-07 e RN-12.
- "Entra" quer dizer que recebe a sessão da própria conta e chega ao Dashboard.

Massa de referência (dados fictícios):
- Ana: e-mail `ana.souza@exemplo.com`, celular (51) 98888-7777, CPF 529.982.247-25, ativa, com conta.
- Bruno: sem e-mail real (a conta usa um e-mail fictício), celular (51) 97777-6666.
- Hugo: de Santa Maria, celular (55) 99999-1234.

- **RN-01**
  - Dada Ana, com a senha certa
  - Quando ela entra com `ana.souza@exemplo.com`, com `(51) 98888-7777` e com `529.982.247-25`
  - Então entra na própria conta nas três vezes.
  - Dado Bruno, com a senha certa
  - Quando alguém tenta entrar com o e-mail fictício de Bruno
  - Então recebe a mensagem única, e a Auditoria registra "Identificação não encontrada".
  - Quando Bruno entra com o celular
  - Então entra.
  - Dada Carla, que trocou o e-mail do cadastro de `carla@antigo.com` para `carla@novo.com`, com a conta de acesso ainda no e-mail antigo
  - Quando ela entra com `carla@novo.com` e a senha certa
  - Então entra.
  - Quando ela tenta com `carla@antigo.com`
  - Então recebe a mensagem única.
- **RN-02**
  - Quando Ana entra com `  Ana.Souza@EXEMPLO.com ` (com espaços nas pontas)
  - Então entra.
  - Quando alguém digita `ana.souza@exemplo.com.br`
  - Então recebe a mensagem única.
- **RN-03**
  - Quando Ana entra com `51988887777`, `+55 (51) 98888-7777`, `5551988887777`, `051 98888-7777` ou `(51) 8888-7777` (sem o 9º dígito)
  - Então entra em todas as formas.
  - Quando Hugo entra com `55999991234` (o 55 de 11 dígitos é o DDD) ou com `+55 55 99999-1234`
  - Então entra nas duas formas.
  - Dada Gabi, com o celular antigo (51) 8877-6655 no cadastro (10 dígitos)
  - Quando ela entra com `(51) 98877-6655`
  - Então entra.
  - Dados Ivo, com (51) 98888-5555, e Joana, com (51) 8888-5555, que são pessoas diferentes
  - Quando Ivo entra com `(51) 98888-5555` e Joana com `5188885555`
  - Então os dois entram, porque a correspondência exata vale primeiro. Não há ambiguidade.
  - Quando alguém digita `9888-7777` (sem DDD) na tela e toca em "Entrar"
  - Então recebe "Confira a identificação: use o CPF, o celular com DDD ou o e-mail.", e nada é enviado (RN-08).
  - Quando a mesma identificação é enviada pela API
  - Então recebe a mensagem única, e a tentativa conta para o limite.
- **RN-04**
  - Quando Ana entra com `52998224725` ou com `529 982 247 25`
  - Então entra.
  - Dado Léo, com o CPF 012.345.678-90
  - Quando ele entra com `01234567890`
  - Então entra, porque o zero à esquerda é mantido no CPF.
  - Quando alguém digita `529.982.247-26` (dígito verificador errado)
  - Então o número é procurado só como celular, e a pessoa recebe a mensagem única.
  - Quando alguém digita `111.111.111-11`
  - Então o número não é procurado como CPF.
- **RN-05**
  - Dados Davi, com o CPF 519.888.877-04, e Elisa, com o celular (51) 98888-7704
  - Quando alguém tenta entrar com `51988887704` e a senha certa de qualquer um dos dois
  - Então recebe a mensagem única, e a Auditoria registra "Identificação ambígua".
  - Quando Davi e Elisa entram com o e-mail de cada um
  - Então entram.
  - Dado o casal Otávio e Paula, com o mesmo celular (51) 96666-5555 nos dois cadastros (antes do E2.04)
  - Quando Paula tenta entrar com esse celular e a senha certa
  - Então recebe a mensagem única. Ela entra com o e-mail ou o CPF dela.
  - Dados Rita, excluída, com o celular (51) 95555-4444, e Sílvia, não excluída, com o mesmo celular
  - Quando Sílvia entra com esse celular
  - Então entra, porque o cadastro excluído não conta.
  - Dado Ulisses, que tem o próprio CPF gravado também no campo de celular
  - Quando ele entra com esse número
  - Então entra, porque o CPF e o celular levam ao mesmo cadastro.
- **RN-06**
  - Dada Nina, inativa, com conta
  - Quando ela entra com a senha certa
  - Então entra.
  - Dado o pastor Samuel, sem líder
  - Quando ele entra
  - Então entra.
  - Dada Lia, numa função sem nenhuma permissão
  - Quando ela entra
  - Então entra, e o menu segue as permissões dela.
  - Dado Quintino, sem conta de acesso
  - Quando ele tenta entrar com o celular
  - Então recebe a mensagem única, e a Auditoria registra "Sem conta de acesso".
  - Dada Rita, excluída, com a conta suspensa (E2.01)
  - Quando ela tenta entrar com o e-mail, o celular ou o CPF e a senha certa
  - Então recebe a mensagem única, e a Auditoria registra "Cadastro excluído".
  - Quando Rita é restaurada (E2.01)
  - Então ela entra com a mesma senha de antes.
  - Dada uma conta de acesso que não tem cadastro de membro
  - Quando alguém tenta entrar com o e-mail dela pela `sign-in`
  - Então recebe a mensagem única.
- **RN-07**
  - Dados os casos (b) a (g) da RN-07
  - Quando cada um é tentado pela tela
  - Então todos mostram a mensagem única, no mesmo lugar.
  - Dados os casos (a) a (g) da RN-07
  - Quando cada um é tentado pela API
  - Então todos recebem o mesmo código e o mesmo conteúdo, sem nenhum dado do cadastro.
  - Dadas 20 tentativas de cada caso, no mesmo ambiente
  - Então a mediana do tempo de resposta de cada caso fica a menos de 100 ms da mediana de "senha errada".
- **RN-08**
  - Quando alguém tenta entrar com a senha em branco, ou com a identificação só com espaços
  - Então a tela mostra "Informe a identificação e a senha." sem chamar a função, e nada conta para o limite.
  - Quando a mesma tentativa é feita pela API
  - Então recebe a mesma mensagem, nada conta para o limite e nada é registrado.
  - Dada uma senha só com espaços
  - Quando a pessoa toca em "Entrar"
  - Então a tentativa é enviada e conferida como qualquer outra senha.
  - Quando alguém digita `ana.souza` (sem "@") ou `98888-7777` e toca em "Entrar"
  - Então a tela mostra "Confira a identificação: use o CPF, o celular com DDD ou o e-mail.", não chama a função, nada conta para o limite e nada é registrado.
  - Quando alguém digita `ana@` e toca em "Entrar"
  - Então a tentativa é enviada, porque tem "@".
  - Dado o app sem conexão
  - Quando Ana tenta entrar
  - Então a tela mostra "Não foi possível entrar. Verifique a conexão e tente de novo.", e nada conta para o limite.
- **RN-09**
  - Dado Marcos, cuja senha é ` Fé 2024` (com espaço no início e acento)
  - Quando ele entra com ` Fé 2024`
  - Então entra.
  - Quando ele tenta com `Fé 2024` ou `fé 2024`
  - Então recebe a mensagem única.
  - Dada qualquer tentativa
  - Então a senha não aparece na Auditoria, nos logs da função nem na tabela de tentativas, e o navegador não calcula MD5 nem nenhum outro hash dela.
- **RN-10**
  - Dada Ana, sem bloqueio
  - Quando são feitas 4 tentativas erradas com `(51) 98888-7777`
  - Então as 4 recebem a mensagem única.
  - Quando a 5ª tentativa errada é feita com `+55 51 98888-7777`, dentro de 15 minutos
  - Então recebe a mensagem de bloqueio com "Aguarde 15 minutos".
  - Quando Ana tenta de novo com o celular e a senha certa, 5 minutos depois
  - Então recebe a mensagem de bloqueio com "Aguarde 10 minutos" e não entra. O bloqueio continua terminando no mesmo horário.
  - Quando Ana entra com o e-mail e a senha certa, durante o bloqueio do celular
  - Então entra.
  - Quando o bloqueio termina e Ana entra com o celular e a senha certa
  - Então entra.
  - Dada a identificação `51911112222`, que não existe
  - Quando são feitas 5 tentativas
  - Então a 5ª recebe a mensagem de bloqueio, igual à de Ana.
  - Dadas 4 falhas e depois um login com sucesso de Ana pelo CPF
  - Quando é feita mais uma falha pelo CPF
  - Então ela recebe a mensagem única, sem bloqueio, porque a contagem foi zerada.
  - Dadas 20 tentativas erradas enviadas ao mesmo tempo com o CPF de Ana
  - Então no máximo 5 têm a senha conferida, e as demais recebem a mensagem de bloqueio.
  - Dado um bloqueio que começa no sábado às 23:55
  - Então ele termina no domingo às 00:10.
- **RN-11**
  - Dadas 49 falhas, vindas da mesma origem, com identificações diferentes, em 10 minutos
  - Quando acontece a 50ª falha
  - Então ela recebe a mensagem de bloqueio.
  - Quando Ana tenta entrar dessa origem com a senha certa, durante o bloqueio
  - Então recebe a mensagem de bloqueio e não entra.
  - Quando Ana tenta, ao mesmo tempo, de outra origem
  - Então entra.
  - Dadas 15 falhas e um login com sucesso, vindos da mesma origem
  - Quando acontecem mais 5 falhas dentro dos 15 minutos
  - Então a origem fica bloqueada, porque o sucesso não zera a contagem da origem.
  - Dadas tentativas de 25 horas atrás
  - Então nenhuma origem delas continua guardada.
- **RN-12**
  - Dado um bloqueio com 30 segundos restantes
  - Então a mensagem diz "Aguarde 1 minuto".
  - Dados a identificação e a origem bloqueadas, com 4 e 12 minutos restantes
  - Então a mensagem diz "Aguarde 12 minutos".
  - Dada Ana, com a sessão aberta num celular, e a identificação dela bloqueada por tentativas feitas em outro aparelho
  - Então a sessão aberta continua funcionando.
  - Dado um bloqueio em andamento
  - Então nenhuma tela, permissão ou função do app o termina antes do prazo.
- **RN-13**
  - Quando Ana entra
  - Então a resposta da função traz só a sessão dela, e o app abre o Dashboard.
  - Quando qualquer tentativa falha, pela tela ou pela API
  - Então a resposta não traz e-mail, nome, celular, CPF nem identificador interno.
  - Dada Ana conectada antes da publicação deste passo
  - Então continua conectada depois dela.
- **RN-14**
  - Dada Ana, com a senha certa
  - Quando alguém tenta entrar pela API, com o e-mail e a senha dela, direto no Auth
  - Então não recebe sessão.
  - Dada a tela de login
  - Quando Ana entra
  - Então o app chama só a `sign-in`.
  - Dada Ana conectada
  - Quando a sessão é renovada
  - Então continua funcionando.
- **RN-15**
  - Quando Ana entra pelo CPF
  - Então a Auditoria tem um registro "Login realizado", com Ana como autora, o tipo CPF e a identificação mascarada, e nenhum registro de login feito pelo app.
  - Quando alguém erra a senha de Ana pelo e-mail
  - Então a Auditoria tem um registro "Falha no login", ligado a Ana, com o motivo "Senha incorreta" e o e-mail mascarado.
  - Quando alguém tenta uma identificação que não existe
  - Então a Auditoria tem um registro "Falha no login" com o motivo "Identificação não encontrada", sem ligação com nenhum cadastro.
  - Tipos de identificação:
    - Quando Ana entra com `(51) 98888-7777`, que não é um CPF válido, Então o tipo é "Celular".
    - Quando Ana entra com `529.982.247-25`, que só o CPF dela encontra, Então o tipo é "CPF".
    - Quando alguém tenta `51988887704` (o caso de Davi e Elisa, RN-05), Então o tipo é "CPF ou celular".
    - Quando Ulisses entra com o número gravado como CPF e como celular, Então o tipo é "CPF ou celular".
    - Quando alguém tenta `123.456.789-09`, um CPF válido que não está em nenhum cadastro, nem como CPF nem como celular, Então o tipo é "CPF ou celular".
    - Quando uma identificação inválida chega pela API, Então o registro não tem tipo.
  - Quando a identificação de Ana é bloqueada e alguém tenta mais 10 vezes durante o bloqueio
  - Então a Auditoria tem um único registro "Login bloqueado por excesso de tentativas", do tipo "Por identificação", com a duração de 15 minutos, e nenhum registro pelas 10 tentativas recusadas.
  - Quando uma origem é bloqueada
  - Então o registro é do tipo "Por origem" e não traz o endereço.
  - Dado qualquer registro de login, de falha ou de bloqueio
  - Então ele não contém a senha, hash, a identificação completa nem a origem.
  - Dada Lia, sem `view_audit_log`
  - Então ela não vê esses registros, nem pela API.
- **RN-16**
  - Dado o app com a `sign-in` em produção e o teste de login aprovado
  - Quando o E1.04 é aceito
  - Então chamar a `get-user-email` em produção, com qualquer CPF ou celular, não devolve nenhum e-mail nem outro dado.
- **RN-17**
  - Dado Tiago, cadastrado pelo app com a senha inicial `123456`
  - Quando ele entra com `123456`
  - Então entra.
  - Dado qualquer membro neste passo
  - Então só a senha da conta de acesso é conferida, e nenhuma credencial legada é lida nem gravada.
  - Dada Carla (RN-01), com a conta de acesso num e-mail diferente do cadastro
  - Então a entrada pelo e-mail do cadastro mostra que a identificação leva ao cadastro, como o E3.02 precisa.

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom, mas não o sentido. Os textos de falha e de conexão são os do E2.01 (P-DEL-21) e não mudam.

| Situação | Texto |
|---|---|
| Título da tela (só para leitor de tela) | Entrar |
| Rótulo e dica do campo | Identificação · CPF, celular ou e-mail (como hoje) |
| Indicador de tipo, ao lado do rótulo (só o formato, PO-UX-2) | E-mail · Celular · CPF · CPF ou celular |
| Botão de ícone no campo Senha (PO-UX-3) | Mostrar senha · Ocultar senha |
| Botão | Entrar · Entrando… |
| Campos vazios | Informe a identificação e a senha. |
| Formato não reconhecido (PO-UX-6) | Confira a identificação: use o CPF, o celular com DDD ou o e-mail. |
| Falha de credencial (qualquer caso da RN-07) | Usuário ou senha inválidos. Confira os dados e tente de novo. |
| Bloqueio (por identificação ou por origem) | Muitas tentativas sem sucesso. Aguarde {N} minutos e tente de novo. Se esqueceu a senha, fale com o seu líder. ("1 minuto" no singular) |
| Falha de conexão, erro do servidor ou tempo-limite | Não foi possível entrar. Verifique a conexão e tente de novo. |
| Auditoria: ação | Login · Login (falha) · Login (bloqueio) · Logout |
| Auditoria: descrição | Login realizado · Falha no login · Login bloqueado por excesso de tentativas |
| Auditoria: segunda linha da descrição (PO-UX-5) | Na falha: {Motivo} · {Cadastro}, quando houver · No bloqueio: {Tipo de bloqueio} · {N} minutos |
| Auditoria: campos do painel (PO-UX-5) | Cadastro · Motivo · Tipo de identificação · Identificação · Tipo de bloqueio · Duração |
| Auditoria: duração | {N} minutos · 1 minuto |
| Auditoria: motivo da falha (só para quem audita) | Identificação inválida · Identificação não encontrada · Identificação ambígua · Cadastro excluído · Sem conta de acesso · Conta de acesso indisponível · Senha incorreta |
| Auditoria: tipo de bloqueio | Por identificação · Por origem |
| Auditoria: tipo de identificação (RN-15, P-LOG-15) | E-mail · Celular · CPF · CPF ou celular. Em "Identificação inválida", sem tipo |

- **Evitar na tela de login:** "usuário não encontrado", "senha incorreta" ou qualquer texto que diferencie os casos da RN-07; "bloqueado", "bloqueio" e "suspensa", para não confundir com a conta suspensa; e textos do Auth em inglês.
- O indicador de tipo e o aviso de formato só descrevem o que foi digitado. Eles nunca dependem do que existe nos cadastros.
- "Login" e "Logout" já são os rótulos da Auditoria. Por coerência, este passo segue com eles.

### Fora de escopo
Cada item indica o passo que cuida dele.
- **"Esqueci minha senha"** e o SMTP próprio: E1.07, ainda sem credenciais.
- **Senha legada:** a tabela `private.legacy_credentials` (E3.01), a conferência do MD5, a política de senha e a marca `must_change_password` (E3.02). Os testes do login legado ficam no E3.03.
- **Redefinição assistida,** a troca obrigatória de senha e o escopo e o perfil do alvo na `change-member-password`: E2.03.
- **Troca do domínio dos e-mails fictícios:** E1.06. A `sign-in` recusa os dois domínios (RN-01).
- **Unicidade de e-mail, celular e CPF** (índices MEM-03 e MEM-05): E2.04. Até lá, os casos repetidos caem na RN-05.
- **Criação das contas de acesso** na migração: E4.08.
- **Comunicação aos usuários** (6.7): E3.05.
- Desbloqueio manual e uma tela para consultar tentativas ou bloqueios.
- Bloqueio progressivo, CAPTCHA, verificação em duas etapas, login por rede social, link mágico, "lembrar de mim" e a duração da sessão, que continua a de hoje.
- Avisar o membro, por e-mail ou WhatsApp, sobre tentativas suspeitas.
- A senha inicial `123456`, que foi decidida na D11.
- A saída (logout), que continua como está.

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E2.01:**
  - Se o E1.04 vier antes, a tarefa da DT-14 (filtrar os excluídos na `get-user-email`) passa a valer para a `sign-in`, que já trata os excluídos (RN-06, RN-07).
  - O PR 6 do E2.01 (mensagem única no `Alert` do login, T10 e `session.ts`) mexe na mesma tela que este passo. O passo que vier primeiro implementa, e o outro reaproveita.
  - A diferença de tempo entre "senha errada" e "conta inexistente", deixada em aberto na AQ-10 e na leitura técnica 4, fecha aqui (RN-07).
- **E2.03:**
  - A tela de troca obrigatória de senha usa a sessão vinda da `sign-in` (RN-17 d).
  - Vale avaliar se a redefinição assistida também termina o bloqueio por tentativas daquele membro. Neste passo, ela não termina (RN-12).
  - **Observação para o usuário (não muda a D11):** o limite de tentativas não protege uma senha conhecida. Quem conhece o CPF ou o celular de um membro que nunca trocou a senha `123456` consegue entrar na primeira tentativa. A troca obrigatória do E2.03 pode cobrir as contas criadas com a senha inicial.
- **E2.04:**
  - A unicidade do celular deveria usar a mesma equivalência da RN-03 (55, zeros e 9º dígito). Assim, dois cadastros não conseguem gravar números que o login trata como iguais, e a RN-05 só acontece em dados antigos.
  - A normalização fica num lugar só (DT-17 do E2.01).
- **E1.06:** a `sign-in` precisa reconhecer o domínio fictício antigo e o novo enquanto existirem contas com os dois.
- **E3.02:** usa o ponto da RN-17. A conferência do MD5 herda as RN-07, RN-10, RN-11, RN-14 e RN-15 sem mudança.
- **E4.08 e seção 6.2:** a 6.2 cria a conta só para quem tem e-mail ou celular. Com a D5, um membro que só tem CPF ficaria sem conta e não entraria (RN-06). Recomendação do PO: alinhar a 6.2 com a D5 no E4.08. No legado, esse membro também não entrava.
- **E3.05 e seção 6.7:** a comunicação pode dizer que o celular e o CPF valem com ou sem pontuação, e que, depois de muitas tentativas, é preciso esperar 15 minutos.
- **Consolidação (futuro):** o consolidado não entra no sistema até virar membro. A `sign-in` precisa tratá-lo como identificação não encontrada quando a flag existir.
- **Deploy:** a `sign-in` entra na lista de funções do workflow "Deploy: banco", e a `get-user-email` sai dela. Tirar da lista não apaga a função publicada, então a remoção é uma ação à parte (RN-16).

### Pontos para o `architect`
Não são dúvidas de negócio. São pontos em que a regra depende de uma escolha técnica.
1. **Caminho único (RN-14).** É preciso fechar o login com senha direto no Auth sem quebrar a renovação de sessão. Uma ideia é o hook de emissão de token do Auth, mas a disponibilidade de cada hook no plano atual precisa ser conferida. Se não houver caminho viável, a regra volta ao PO antes da implementação.
2. **Limites do próprio Auth.** Todos os logins vão sair do endereço da função, como a 6.3 já aponta. Os limites de taxa do Auth não podem barrar usuários de verdade, principalmente no dia do cutover.
3. **Origem confiável (RN-11).** O endereço do cliente precisa vir de um cabeçalho em que se possa confiar. Se a função aceitar um endereço enviado pelo próprio cliente, o limite por origem pode ser contornado.
4. **Tempo igual (RN-07):** inclusive quando o cadastro não existe ou não tem conta, e no futuro ponto do E3.02.
5. **Contagem atômica** (RN-10, RN-11): sem passar do limite com tentativas simultâneas, recusando quando a contagem falha, e apagando a origem em até 24 horas.
6. **Busca pelo cadastro (RN-01, RN-03).** A conta do Auth pode ter um e-mail diferente do cadastro. A forma de comparar o celular precisa de índice para não varrer a tabela a cada tentativa.
7. **Auditoria (RN-15):**
   - a ação nova de bloqueio;
   - o registro de falha sem sessão, ligado ao cadastro quando houver;
   - o volume de registros num ataque distribuído.
8. **Saída da `get-user-email` (RN-16):** a ordem do deploy, o `config.toml` e o rollback do app.
9. **Front:** a `sign-in` é chamada antes do login, só com a chave pública, como a `get-user-email` hoje (`verify_jwt`).

### Perguntas em aberto
Nenhuma. Os pontos que as fontes não respondiam viraram padrões, listados em "Padrões definidos por este spec", para o usuário revisar no PR. Os que mais mudam o resultado são:
- **P-LOG-05 e P-LOG-06:** os números do limite (5 por identificação e 20 por origem, em 15 minutos, com 15 minutos de bloqueio), sobretudo o da origem, por causa da rede da igreja.
- **P-LOG-08:** recusar o login com senha direto no Auth.
- **P-LOG-02:** a equivalência do celular com e sem o 9º dígito.
- **P-LOG-07:** não ter desbloqueio manual.
- **P-LOG-14:** o aviso de formato antes de enviar, que veio da PO-UX-6.

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-23 a partir da seção Negócio (RN-01 a RN-17, P-LOG-01 a P-LOG-12), da T10 do [`e2-01-exclusao-logica.md`](e2-01-exclusao-logica.md) e do código atual do `mci-connect` (`src/pages/Login.tsx`, `src/pages/Events.tsx` e `e2e/login.spec.ts`, no commit `1499c03`). É uma passada curta: só a tela de Login e os rótulos da Auditoria. Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" e listada em "Pendências para o PO"._

_A T10 do E2.01 (mensagem única num `Alert`, mensagem de conexão própria e "Sua sessão terminou…") foi reaproveitada. Os ajustes estão em "Ajustes na T10 do E2.01"._

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **Um espaço de mensagens só, no topo do formulário**, abaixo do cabeçalho e acima de "Identificação". Ali aparecem todas as mensagens do login: o aviso de sessão encerrada (E2.01), campos vazios, falha de credencial, bloqueio e conexão. Só uma por vez: cada resposta troca a anterior. **Muda a posição da T10**, que punha a falha entre a senha e o botão. | No celular, depois de uma falha, o foco volta para a Senha e o teclado ocupa a metade de baixo da tela. Uma mensagem embaixo da senha fica escondida atrás do teclado. No topo, ela continua visível acima do campo em foco. No desktop, a posição não faz diferença. |
| UXD-2 | **Bloqueio sem contagem regressiva, com "Entrar" habilitado.** A mensagem traz o {N} da resposta e não muda sozinha. Ela sai na próxima tentativa ou some, sem anúncio, quando passam os {N} minutos. *Definido pela UX (PO-UX-1).* | (1) A tela não sabe se o bloqueio é por identificação ou por origem, e a RN-12 manda não dizer. Desativar o botão impediria o caminho legítimo da RN-10: entrar com outra identificação. (2) Tentar durante o bloqueio não o estende (RN-10), então o botão habilitado não prejudica ninguém. (3) Uma contagem que muda a cada minuto faz o leitor de tela repetir a mensagem e mantém um relógio rodando num celular de entrada. (4) Sem o sumiço, quem volta depois de 15 minutos ainda lê "Aguarde 15 minutos". |
| UXD-3 | **O foco depende do caso.**<br>- Falha de credencial: vai para a Senha, que é limpa (como na T10).<br>- Campos vazios: vai para o primeiro campo vazio.<br>- Bloqueio: vai para a própria mensagem, e a senha é limpa.<br>- Conexão ou servidor: não muda, e nada é limpo. | Cada caso leva o foco ao que a pessoa faz em seguida. No bloqueio não há o que digitar: o foco na mensagem fecha o teclado e deixa as 3 ou 4 linhas inteiras na tela. Na conexão, a senha não foi conferida, e redigitar só atrasa. |
| UXD-4 | **Campos vazios são conferidos pela tela, ao tocar em "Entrar"**, no mesmo espaço de mensagens, sem o balão do navegador ("Preencha este campo"). A identificação só com espaços conta como vazia (RN-02). A senha só com espaços não conta (RN-09). | A RN-08 pede essa mensagem antes de enviar. O balão nativo aparece antes dela, some sozinho e muda de texto conforme o navegador. |
| UXD-5 | **O indicador de tipo continua**, só como confirmação do formato: "E-mail", "Celular", "CPF" ou, na ambiguidade, **"CPF ou celular"**. Ele segue as RN-02 a RN-04, nunca consulta o servidor e não muda o que é enviado. *O texto "CPF ou celular" é definido pela UX (PO-UX-2).* | Para quem tem pouca familiaridade com tecnologia, ver "Celular" ao lado do campo confirma que o número foi entendido. Com 11 dígitos e CPF válido, o servidor procura o número como CPF **e** como celular (RN-03, RN-04). Mostrar só "CPF" erraria em cerca de 1 % dos celulares, porque cerca de 1 em 100 números de 11 dígitos passa nos dígitos verificadores. "CPF ou celular" nunca erra. Um CPF com o dígito errado aparece como "Celular", o que já é um sinal de que algo está errado. |
| UXD-6 | **Botão "Mostrar senha"** dentro do campo Senha. A senha começa oculta e volta a ficar oculta a cada envio. *Definido pela UX (PO-UX-3).* | Com o limite de 5 tentativas (RN-10), um erro de digitação custa caro. Digitar a senha às cegas num teclado pequeno é a causa mais comum de erro. Ver o que digitou, quando quiser, evita bloqueios sem expor a senha por padrão. |
| UXD-7 | **Enter na Identificação, com a senha vazia, leva o foco para a Senha**, sem mensagem e sem envio. Com a senha preenchida, envia. | No celular, o botão de ação do teclado é o caminho natural para o próximo campo. Sem isso, o iOS envia o formulário e mostra "Informe a identificação e a senha." só porque a pessoa avançou de campo. |
| UXD-8 | **Auditoria legível para os eventos de autenticação.** O motivo da falha e o tipo e a duração do bloqueio aparecem na linha, abaixo da descrição. No painel de detalhes, os dados viram campos com nome (Cadastro, Tipo de identificação, Identificação, Motivo, Tipo de bloqueio, Duração), no lugar do JSON de "Metadados". | Quem audita quer bater o olho e ver "Senha incorreta" ou "Por origem · 15 minutos" sem abrir cada linha. O JSON (`identifier_masked`) não é linguagem de usuário. |

### Ajustes na T10 do E2.01
Registrados aqui porque este passo reabre a tela. A T10 e o PR 6 do E2.01 ainda não foram implementados (o `Login.tsx` usa toast), então o passo que vier primeiro já implementa a versão ajustada. O UX-35 e o UX-36 do E2.01 continuam valendo, com estas leituras:
1. **Posição:** a mensagem de falha sai de "entre a senha e o botão" e vai para o topo do formulário, no mesmo lugar do aviso de sessão encerrada (UXD-1).
2. **"Uma mensagem só" tem exceções definidas pelo Negócio:** campos vazios, bloqueio por tentativas e conexão ou servidor (a de conexão já existia na T10). No UX-35 do E2.01, "conta bloqueada" quer dizer a **conta suspensa** do membro excluído (DT-13), que continua com a mensagem única. O "bloqueio" deste spec é o bloqueio por tentativas, com mensagem própria.
3. **Conexão:** a T10 não dizia o que acontece com os campos. Agora está definido: os dois ficam como estavam, e o foco não muda (UXD-3).
4. **Repetição:** a mesma mensagem, depois de uma nova tentativa, é anunciada de novo pelo leitor de tela (UX-04).
5. **Leitor de tela no bloqueio:** a mensagem recebe o foco e, por isso, não usa `role="alert"`, para não ser lida duas vezes (UXD-3, UX-06).

### Navegação e rotas
- Nenhuma rota nova. O sucesso abre o Dashboard (`/`), como hoje.
- O aviso de sessão encerrada chega pelo estado da navegação, como no E2.01, e sai na próxima tentativa de entrar.
- Auditoria: sem mudança de rota. O filtro de ação continua no estado da tela.

### Fluxos
Contagem no celular, a partir da tela de login aberta. "Toque" não conta a digitação.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | Entrar com o celular, o CPF ou o e-mail | toca em Identificação → digita → "próximo" no teclado → digita a senha → "Entrar" (no teclado ou na tela) → Dashboard | 3 toques; 1 tela |
| F2 | Errar a senha e tentar de novo | F1 → mensagem única no topo, identificação mantida, senha limpa e com o foco → digita → "Entrar" | +1 toque (+1 se o teclado não abrir sozinho) |
| F3 | Conferir a senha antes de enviar | digita a senha → "Mostrar senha" → confere → "Entrar" | +1 toque |
| F4 | A 5ª falha (bloqueio) | F2 → mensagem de bloqueio com o foco, teclado fechado. Depois:<br>(a) espera os {N} minutos (a mensagem some) e repete o F1;<br>(b) entra com outra identificação dele, se o bloqueio for só da identificação (a tela não sugere isso, RN-12);<br>(c) fala com o líder, fora do sistema. | 0 toques para ler; (a) e (b) são o F1 |
| F5 | Tocar em "Entrar" com um campo vazio | "Entrar" → "Informe a identificação e a senha.", com o foco no primeiro campo vazio → digita → "Entrar" | +1 toque; nada é enviado |
| F6 | Sem conexão na casa do anfitrião | "Entrar" → mensagem de conexão, os dois campos mantidos → "Entrar" de novo quando a rede voltar | +1 toque, sem redigitar |
| F7 | Sessão encerrada (E2.01) | qualquer tela → login com o aviso → F1 | igual ao F1 |
| F8 | Quem audita procura bloqueios | ☰ → Auditoria → "Ação" → "Login (bloqueio)" → linha → painel | 5 toques no celular; 4 cliques no desktop |
| F9 | Quem audita confere as falhas no cadastro de alguém | ☰ → Auditoria → busca pelo nome → "Ação" → "Login (falha)" → linha | 6 toques e a digitação; 5 cliques no desktop |

### Telas
Convenções do E2.01: 360 px ≈ 38 colunas; `[Botão]` é botão; `[◉]` é o "Mostrar senha"; `⚠` é erro; `◷` é o ícone de relógio; `(i)` é aviso.

#### T1. Login (`src/pages/Login.tsx`)
Celular (360 px). O fundo `bg-primary` tem `p-4`. O cartão ocupa a largura toda, e o conteúdo tem cerca de 280 px.
```
Inicial                                  Falha de credencial (T10, posição nova)
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│              (logo 80)               │ │              (logo 80)               │
│   Missão Carismática Internacional   │ │   Missão Carismática Internacional   │
│            Alvorada / RS             │ │            Alvorada / RS             │
│                                      │ │ ┌──────────────────────────────────┐ │
│ Identificação              [Celular] │ │ │⚠ Usuário ou senha inválidos.     │ │ role="alert"
│ [(51) 98888-7777                   ] │ │ │  Confira os dados e tente de     │ │
│ Senha                                │ │ │  novo.                           │ │
│ [••••••••                      [◉]] │ │ └──────────────────────────────────┘ │
│ [              Entrar              ] │ │ Identificação              [Celular] │
└──────────────────────────────────────┘ │ [(51) 98888-7777                   ] │ mantida
                                         │ Senha                                │
                                         │ [|                             [◉]] │ limpa, com o foco
                                         │ [              Entrar              ] │
                                         └──────────────────────────────────────┘

Bloqueio                                 Campos vazios
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ ┌──────────────────────────────────┐ │ │ ┌──────────────────────────────────┐ │
│ │◷ Muitas tentativas sem sucesso.  │ │ │ │⚠ Informe a identificação e a     │ │ role="alert"
│ │  Aguarde 15 minutos e tente de   │ │ │ │  senha.                          │ │
│ │  novo. Se esqueceu a senha, fale │ │ │ └──────────────────────────────────┘ │
│ │  com o seu líder.                │ │ │ Identificação              [Celular] │
│ └──────────────────────────────────┘ │ │ [(51) 98888-7777                   ] │
│   ↑ recebe o foco (tabIndex=-1),     │ │ Senha                                │
│     sem role="alert"                 │ │ [|                             [◉]] │ aria-invalid, foco
│ Identificação              [Celular] │ │ [              Entrar              ] │
│ [(51) 98888-7777                   ] │ └──────────────────────────────────────┘
│ Senha                                │
│ [                              [◉]] │ limpa
│ [              Entrar              ] │ habilitado, sem contagem
└──────────────────────────────────────┘

Conexão ou servidor                      Enviando
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ ┌──────────────────────────────────┐ │ │ (a mensagem anterior, se houver,     │
│ │⚠ Não foi possível entrar.        │ │ │  continua no lugar)                  │
│ │  Verifique a conexão e tente de  │ │ │ Identificação              [Celular] │
│ │  novo.                           │ │ │ [(51) 98888-7777                   ] │
│ └──────────────────────────────────┘ │ │ Senha                                │
│ Identificação              [Celular] │ │ [••••••••                      [◉]] │
│ [(51) 98888-7777                   ] │ │ [         (◌) Entrando…            ] │ desabilitado
│ Senha                                │ └──────────────────────────────────────┘
│ [••••••••                      [◉]] │ mantida
│ [              Entrar              ] │ serve de "Tentar de novo"
└──────────────────────────────────────┘
```
Desktop (≥ 1024 px): o mesmo cartão, centralizado na horizontal e na vertical, com `max-w-md` (448 px). Nada muda de estrutura.
```
┌───────────────────────────────────────────────────────────────────────┐ bg-primary
│                  ┌──────────────────────────────────┐                 │
│                  │            (logo 80)             │                 │
│                  │ Missão Carismática Internacional │                 │
│                  │          Alvorada / RS           │                 │
│                  │ [Alert, quando houver]           │                 │
│                  │ Identificação           [E-mail] │                 │
│                  │ [ana.souza@exemplo.com         ] │                 │
│                  │ Senha                            │                 │
│                  │ [••••••••                    [◉]]│                 │
│                  │ [             Entrar           ] │                 │
│                  └──────────────────────────────────┘                 │
└───────────────────────────────────────────────────────────────────────┘
```
- **Breakpoints:**
  - abaixo de 640 px, o cartão ocupa a largura menos o `p-4`;
  - a partir de `sm`, fica limitado a `max-w-md`;
  - a tela usa `min-h-dvh` (hoje é `min-h-screen`), para não errar a altura quando a barra do navegador aparece;
  - em paisagem ou com a fonte grande, o cartão fica mais alto que a tela e a página rola. Nada é cortado.
- **Componentes:** `Card`, `Label`, `Input`, `Button` (`size="lg"`, `w-full`), `Badge` (`variant="outline"`) e `Alert`. Nenhum componente novo do shadcn.
- **Espaço de mensagens (UXD-1):** um `Alert` no topo do `<form>`, antes de "Identificação".
  - Ícones do `lucide-react`, com `aria-hidden`: `AlertCircle` na falha e nos campos vazios, `WifiOff` na conexão, `Clock` no bloqueio e `Info` no aviso de sessão.
  - As mensagens de erro usam `variant="destructive"` com o texto em `text-foreground` (ver Acessibilidade, contraste). O aviso de sessão usa `variant="default"`.
  - O `Alert` é montado de novo a cada resposta (por exemplo, `key` com o número da tentativa), para que a mesma mensagem seja anunciada outra vez. Enquanto envia, a mensagem anterior continua no lugar, para a tela não saltar.
- **Campo Identificação:**
  - rótulo "Identificação" e placeholder "CPF, celular ou e-mail", como hoje (o `e2e/login.spec.ts` confere os dois);
  - `type="text"`, `autoComplete="username"`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}` e `enterKeyHint="next"`;
  - `className="h-11"`; a fonte de 16 px no celular já vem do `Input`.
- **Indicador de tipo (UXD-5):** o `Badge` fica na linha do rótulo (`flex flex-wrap items-center justify-between gap-2`), fora do `<label>`.
  - Ele não tem `aria-live` e usa `variant="outline"`, porque o `secondary` de hoje dá cerca de 3:1 (texto branco sobre `--secondary`).
  - A animação de entrada leva `motion-reduce:animate-none`.
  - Regra, só pelo formato:
    1. vazio, depois de tirar os espaços das pontas: nada;
    2. com "@": **E-mail**;
    3. sem "@", só os dígitos contam (RN-03):
       - é **celular** se, sem os zeros à esquerda e sem o 55 inicial quando há 12 ou 13 dígitos, sobram 10 ou 11 dígitos;
       - é **CPF** se tem exatamente 11 dígitos, contando os zeros à esquerda, e dígitos verificadores válidos (RN-04);
       - os dois: **CPF ou celular**; só um: **Celular** ou **CPF**; nenhum: nada.
  - Exemplos na tabela "Indicador de tipo: exemplos", no fim da T1 (UX-10).
- **Campo Senha:**
  - `type="password"` (ou `text`, quando visível), `autoComplete="current-password"`, `enterKeyHint="go"` e `className="h-11 pr-12"`;
  - "Mostrar senha" (UXD-6) é um `Button` `variant="ghost"`, `type="button"`, de 44×44 px, posicionado dentro do campo, à direita;
  - ícones `Eye` e `EyeOff`, com `aria-label` "Mostrar senha" ou "Ocultar senha" e `aria-pressed`.
- **Formulário:** `noValidate`. Os campos mantêm `required`, que o leitor de tela anuncia, mas a conferência é a da tela (UXD-4).
- **Botão:** "Entrar". Enquanto envia, mostra "Entrando…", com `Loader2` (`animate-spin motion-reduce:animate-none`), e fica desabilitado. Um duplo toque não envia duas vezes.
- **Sem toast:** o `useToast` sai do login. Nenhuma mensagem do servidor é exibida como veio.

Indicador de tipo: exemplos (UX-10)

| Digitado | Indicador |
|---|---|
| `ana.souza@exemplo.com` | E-mail |
| `(51) 98888-7777`, `+55 (51) 98888-7777`, `5551988887777`, `051 98888-7777`, `(51) 8888-7777`, `55999991234`, `+55 55 99999-1234` | Celular |
| `529.982.247-25`, `52998224725`, `012.345.678-90` | CPF ou celular |
| `529.982.247-26` (dígito verificador errado) | Celular |
| `000.000.001-91` | CPF |
| `9888-7777` (sem DDD) | nada |

#### T2. Auditoria (`src/pages/Events.tsx`)
Só rótulos e a leitura dos eventos de autenticação. A tabela continua igual, inclusive a rolagem horizontal no celular.

Linhas (desktop, e a mesma tabela no celular):
```
| Data/Hora        | Autor     | Ação               | Entidade     | Descrição                                  | Status |
|------------------|-----------|--------------------|--------------|--------------------------------------------|--------|
| 23/11/2026 21:40 | —         | [Login (bloqueio)] | Autenticação | Login bloqueado por excesso de tentativas  | [Erro] |
|                  |           |                    |              | Por identificação · 15 minutos             |        |
| 23/11/2026 21:39 | —         | [Login (falha)]    | Autenticação | Falha no login                             | [Erro] |
|                  |           |                    |              | Senha incorreta · Ana Souza                |        |
| 23/11/2026 21:31 | —         | [Login (falha)]    | Autenticação | Falha no login                             | [Erro] |
|                  |           |                    |              | Identificação não encontrada               |        |
| 23/11/2026 21:30 | Ana Souza | [Login]            | Autenticação | Login realizado                            | [OK]   |
```
- **Ação:** "Login (bloqueio)" entra no `ACTION_LABELS`. O filtro "Ação" é montado a partir dele, então a opção aparece sozinha. A ordem fica: Login, Login (falha), Login (bloqueio), Logout.
- **Descrição:** abaixo do texto, numa segunda linha `text-sm text-muted-foreground`, unida por " · ":
  - na falha: o motivo e, quando a falha está ligada a um cadastro, o nome dele;
  - no bloqueio: o tipo e a duração ("Por identificação · 15 minutos", "Por origem · 15 minutos") e o nome do cadastro, se o `architect` o ligar;
  - no login realizado e no logout: nada muda.
- **Autor:** "—" na falha e no bloqueio, porque não há sessão. O cadastro ligado à falha não é o autor, então vai para a descrição e para o campo "Cadastro".

Painel de detalhes (`Sheet`, largura toda no celular):
```
Falha                                    Bloqueio por identificação
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Detalhes do evento               [✕] │ │ Detalhes do evento               [✕] │
│ 23/11/2026 21:39                     │ │ 23/11/2026 21:40                     │
│ Autor                                │ │ Autor                                │
│ —                                    │ │ —                                    │
│ Ação               Entidade          │ │ Ação               Entidade          │
│ Login (falha)      Autenticação      │ │ Login (bloqueio)   Autenticação      │
│ Descrição                            │ │ Descrição                            │
│ Falha no login                       │ │ Login bloqueado por excesso de       │
│ Motivo                               │ │ tentativas                           │
│ Senha incorreta                      │ │ Tipo de bloqueio   Duração           │
│ Cadastro                             │ │ Por identificação  15 minutos        │
│ Ana Souza                            │ │ Tipo de identificação                │
│ Tipo de identificação                │ │ Celular                              │
│ E-mail                               │ │ Identificação                        │
│ Identificação                        │ │ ***7777                              │
│ a***@exemplo.com                     │ └──────────────────────────────────────┘
└──────────────────────────────────────┘
```
- Para `entity = auth`:
  - o campo que hoje se chama "Identificação" e mostra o `entity_label` passa a se chamar **"Cadastro"**, para não confundir com a identificação digitada;
  - o campo "Erro" (`error_reason`) passa a se chamar **"Motivo"**, em `text-foreground`;
  - os metadados conhecidos viram campos (Tipo de identificação, Identificação, Tipo de bloqueio, Duração), e o bloco "Metadados" em JSON não aparece;
  - cada campo só aparece quando tem valor. No bloqueio por origem, não há Identificação nem Cadastro, e a origem nunca aparece (RN-15 d).
- Os outros eventos ficam como estão.

### Estados
| Estado | Login (T1) | Auditoria (T2) |
|---|---|---|
| Carregando | "Entrando…" no botão, desabilitado. A mensagem anterior continua no lugar | Sem mudança ("Carregando...") |
| Vazio | Campos vazios ao tocar em "Entrar": "Informe a identificação e a senha.", foco no primeiro campo vazio, nada enviado | Filtro "Login (bloqueio)" sem eventos: "Nenhum evento encontrado", como hoje |
| Erro | Formato não reconhecido (PO-UX-6): aviso no espaço de mensagens, foco na Identificação, nada limpo e nada enviado. Falha de credencial: mensagem única, senha limpa e com o foco. Bloqueio: mensagem com {N}, senha limpa, foco na mensagem, "Entrar" habilitado; a mensagem some depois de {N} minutos | Sem mudança |
| Sem permissão | — (entrar não depende de permissão) | Sem `view_audit_log`, vai para `/`, como hoje |
| Sucesso | Abre o Dashboard, sem toast | — |
| Lista grande | — | Sem mudança: os 500 eventos mais recentes. Ver AQ-6 |
| Queda de conexão no envio | "Não foi possível entrar. Verifique a conexão e tente de novo.", os dois campos mantidos, foco sem mudança. O erro do servidor e o tempo-limite (AQ-2) mostram o mesmo texto | — |
| Sessão encerrada (E2.01) | "Sua sessão terminou. Entre de novo para continuar." no mesmo espaço, com `role="status"`. Sai na próxima tentativa | — |

### Textos
Os textos de login vêm dos "Textos de tela" do Negócio e do E2.01, sem mudança de sentido. Os marcados com † são definidos pela UX e estão nas pendências.

| Onde | Texto |
|---|---|
| Título da tela (`h1`, só para leitor de tela) † | Entrar |
| Rótulos e dica | Identificação · CPF, celular ou e-mail (placeholder) · Senha |
| Indicador de tipo | E-mail · Celular · CPF · CPF ou celular † |
| Mostrar senha † | Mostrar senha · Ocultar senha (rótulos do botão de ícone) |
| Botão | Entrar · Entrando… |
| Campos vazios | Informe a identificação e a senha. |
| Formato não reconhecido (PO-UX-6, adotado pelo PO) | Confira a identificação: use o CPF, o celular com DDD ou o e-mail. |
| Falha de credencial | Usuário ou senha inválidos. Confira os dados e tente de novo. |
| Bloqueio | Muitas tentativas sem sucesso. Aguarde {N} minutos e tente de novo. Se esqueceu a senha, fale com o seu líder. ("Aguarde 1 minuto", no singular) |
| Conexão, erro do servidor ou tempo-limite | Não foi possível entrar. Verifique a conexão e tente de novo. |
| Sessão encerrada (E2.01) | Sua sessão terminou. Entre de novo para continuar. |
| Auditoria: ação e filtro | Login · Login (falha) · Login (bloqueio) · Logout |
| Auditoria: descrição | Login realizado · Falha no login · Login bloqueado por excesso de tentativas |
| Auditoria: segunda linha † | Na falha: {Motivo} · {Cadastro} · No bloqueio: {Tipo de bloqueio} · {N} minutos |
| Auditoria: campos do painel † | Cadastro · Motivo · Tipo de identificação · Identificação · Tipo de bloqueio · Duração · {N} minutos / 1 minuto |
| Auditoria: valores | Motivos, tipos de bloqueio e tipos de identificação dos "Textos de tela" do Negócio · CPF ou celular † (tipo, conforme a RN-15: o número foi procurado como os dois, e os dois caminhos levaram a algum cadastro ou nenhum levou) |

**Evitar na tela de login**, além do que o Negócio lista: "bloqueado", "bloqueio", "suspensa", "não encontrado", "senha incorreta" e qualquer texto do Auth em inglês.

### Acessibilidade
- **Semântica:**
  - um `<h1 className="sr-only">Entrar</h1>`, porque hoje a tela não tem título;
  - o logotipo tem `alt`; o nome da igreja continua em `<p>`.
- **Rótulos:** "Identificação" e "Senha" ligados aos campos por `htmlFor`. O indicador de tipo fica fora do `<label>`, então o nome do campo continua sendo só "Identificação". O "Mostrar senha" tem `aria-label` e `aria-pressed`.
- **Anúncios (UXD-1, UXD-3):**
  - a falha de credencial, os campos vazios e a conexão usam `role="alert"`, e a mensagem é montada de novo a cada resposta, para ser anunciada mesmo quando o texto se repete;
  - o bloqueio não usa `role="alert"`: ele recebe o foco (`tabIndex={-1}`), e o foco já faz a leitura;
  - o aviso de sessão usa `role="status"`;
  - o indicador de tipo não é anunciado a cada tecla.
- **Campos vazios:** os campos vazios recebem `aria-invalid="true"` e `aria-describedby` apontando para a mensagem. Os dois atributos saem na tentativa seguinte.
- **Foco visível:** a mensagem do bloqueio, quando focada, mostra o anel de foco (`focus-visible:ring-2 ring-ring`).
- **Contraste, nos dois temas:**
  - o `Alert` `destructive` usa o texto em `text-foreground`. No tema escuro, `text-destructive` sobre o cartão dá cerca de 1,8:1. Hoje o app não liga o tema escuro, mas o token existe;
  - o ícone do `Alert` usa `text-destructive` no claro (cerca de 4,8:1 sobre branco) e `dark:[&>svg]:text-foreground` no escuro;
  - os badges do indicador usam `outline`, e o "OK" da Auditoria também passa a usar `outline`, porque o `secondary` dá cerca de 3:1.
- **Sem depender de cor:** cada mensagem tem ícone e texto, e o "Erro" da Auditoria é texto.
- **Toque:** "Entrar", os dois campos e o "Mostrar senha" têm 44 px de altura, com pelo menos 8 px entre si.
- **Zoom e fonte grande:** com 200 %, nada tem altura fixa. A mensagem quebra linha, e a linha do rótulo com o indicador quebra com `flex-wrap`.
- **Movimento:** o `animate-fade-in` do cartão, a animação do indicador e o giro do `Loader2` levam `motion-reduce:`.

### Critérios de UX
Numeração própria deste spec. Do E2.01, continuam valendo o UX-35 e o UX-36, com os ajustes registrados acima, e o UX-39 (nenhuma mensagem técnica).

| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | Com a identificação vazia (ou só com espaços) ou a senha vazia, tocar em "Entrar":<br>- mostra "Informe a identificação e a senha." no espaço de mensagens;<br>- não faz nenhuma requisição à `sign-in`;<br>- marca os campos vazios com `aria-invalid`;<br>- leva o foco ao primeiro campo vazio.<br><br>Nenhum balão do navegador aparece. Uma senha só com espaços é enviada. | teste de componente + teste E2E (rede interceptada) |
| UX-02 | Enter na Identificação com a senha vazia leva o foco à Senha, sem mensagem e sem requisição. Com a senha preenchida, Enter em qualquer campo envia. | teste de componente |
| UX-03 | Todas as mensagens do login (sessão encerrada, campos vazios, formato não reconhecido, falha, bloqueio e conexão) aparecem no mesmo lugar, **acima de "Identificação"**, uma por vez. Em 360×800, com o foco na Senha, a mensagem fica acima do campo. | teste E2E (360×800, resposta simulada) |
| UX-04 | Cada resposta substitui a mensagem anterior. Duas falhas seguidas com o mesmo texto geram dois anúncios: o elemento é montado de novo. Enquanto envia, a mensagem anterior continua no lugar. | teste de componente |
| UX-05 | Falha de credencial: mensagem única com `role="alert"`, identificação mantida, senha limpa e com o foco (T10). Nenhum texto distingue os casos da RN-07. | teste E2E (respostas simuladas para cada caso) |
| UX-06 | Bloqueio:<br>- a mensagem traz o {N} da resposta, com "1 minuto" no singular;<br>- a identificação fica e a senha é limpa;<br>- o foco vai para a mensagem, que não tem `role="alert"`;<br>- "Entrar" continua habilitado, sem contagem regressiva;<br>- uma nova tentativa troca a mensagem pela da nova resposta;<br>- depois de {N} minutos sem nova tentativa, a mensagem some sem anúncio. | teste de componente (relógio simulado) |
| UX-07 | Conexão, erro do servidor (5xx) e tempo-limite (AQ-2) mostram "Não foi possível entrar. Verifique a conexão e tente de novo.". Os dois campos continuam preenchidos, o foco não muda e "Entrar" volta a ficar habilitado. | teste de componente (fetch rejeitado, 500, tempo-limite) |
| UX-08 | Enquanto envia, o botão mostra "Entrando…", fica desabilitado, e um duplo toque gera uma requisição só. | teste de componente |
| UX-09 | Nenhum texto da tela de login contém "bloquead", "suspens", "não encontrad", "senha incorreta" nem texto em inglês do Auth, e o login não usa toast. | teste unitário (módulo de textos) + teste de componente |
| UX-10 | O indicador segue a tabela da T1, linha a linha, e nunca faz requisição. | teste unitário (Vitest, a tabela da T1) |
| UX-11 | O indicador fica fora do `<label>` (o nome acessível do campo é só "Identificação"), não tem `aria-live`, usa `variant="outline"` e respeita `motion-reduce`. | teste de componente |
| UX-12 | Os campos têm os atributos da T1:<br>- Identificação: `autoComplete="username"`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}` e `enterKeyHint="next"`;<br>- Senha: `autoComplete="current-password"` e `enterKeyHint="go"`.<br><br>O rótulo "Identificação" e o placeholder "CPF, celular ou e-mail" continuam. | teste de componente + `e2e/login.spec.ts` |
| UX-13 | "Mostrar senha" é um botão de 44×44 px, `type="button"`, com `aria-label` e `aria-pressed` que acompanham o estado. Ele não envia o formulário e devolve o foco ao campo. A senha volta a ficar oculta a cada envio. | teste de componente |
| UX-14 | Em 360×800 e 320×568:<br>- não há rolagem horizontal;<br>- campos e botão têm 44 px de altura;<br>- com a mensagem de bloqueio, a mais longa, e o teclado fechado, "Entrar" fica visível sem rolar em 360×800.<br><br>Com a fonte em 200 %, nada é cortado. A tela usa `min-h-dvh`. | teste E2E (viewport) + inspeção |
| UX-15 | Na Auditoria, a ação do bloqueio aparece como "Login (bloqueio)", na linha e no painel. O filtro "Ação" tem a opção, entre "Login (falha)" e "Logout", e ela lista só os bloqueios. | teste de componente |
| UX-16 | Nas linhas de "Login (falha)", a descrição tem uma segunda linha com o motivo e, quando houver, o nome do cadastro. Nas de "Login (bloqueio)", tem o tipo e a duração ("Por origem · 15 minutos"). O autor é "—". | teste de componente |
| UX-17 | No painel de um evento de autenticação:<br>- aparecem "Cadastro", "Motivo", "Tipo de identificação", "Identificação", "Tipo de bloqueio" e "Duração", só os que têm valor;<br>- não aparece o JSON de "Metadados";<br>- a origem não aparece em lugar nenhum da tela.<br><br>Os outros eventos ficam como estão. | teste de componente |
| UX-18 | Contraste nos dois temas: a mensagem do login tem texto com 4,5:1 e ícone com 3:1. O indicador e o "OK" da Auditoria têm texto com 4,5:1. | inspeção (axe, temas claro e escuro) |
| UX-19 | *(Acrescentado pelo PO na PO-UX-6.)* Com a identificação preenchida, sem "@", e sem a forma de um celular nem de um CPF (o indicador mostra "nada", como em `9888-7777` e `ana.souza`), tocar em "Entrar":<br>- mostra "Confira a identificação: use o CPF, o celular com DDD ou o e-mail." no espaço de mensagens, com `role="alert"` e o ícone `AlertCircle`;<br>- não faz nenhuma requisição à `sign-in`;<br>- marca a Identificação com `aria-invalid`, leva o foco a ela e não limpa nenhum campo.<br><br>Com "@", a tentativa é sempre enviada. Os campos vazios (UX-01) são conferidos antes do formato. | teste de componente + teste E2E (rede interceptada) |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão se a resposta for "não".

- **AQ-1. Resultado da `sign-in` para a tela.** A tela precisa distinguir cinco resultados, sem nada que diferencie os casos da RN-07:
  - sucesso, com a sessão;
  - falha de credencial;
  - bloqueio, com os minutos que faltam (já arredondados para cima) ou os segundos;
  - campos vazios;
  - erro do servidor.

  Com o `supabase.functions.invoke`, uma resposta que não é 2xx vira `FunctionsHttpError`, e a tela precisa ler o status e o corpo. *Padrão sem o tempo restante:* não dá para cumprir a RN-12. É obrigatório.
- **AQ-2. Tempo-limite no cliente.** Sugestão: 20 s, depois do qual a tela mostra a mensagem de conexão. Considere o tempo igual da RN-07 (se a função segura a resposta até um piso fixo) e o 3G na casa do anfitrião. *Padrão sem isso:* "Entrando…" pode ficar na tela indefinidamente.
- **AQ-3. A regra do indicador é a mesma do servidor** (RN-03 e RN-04: zeros, 55 com 12 ou 13 dígitos, 10 ou 11 dígitos, CPF com dígitos verificadores e sem dígitos todos iguais). Se a normalização não puder ficar num lugar só (DT-17 do E2.01), as duas implementações precisam passar pela mesma tabela de casos (a da T1 e os critérios das RN-03 e RN-04). *Se divergirem,* o indicador mostra um tipo que o servidor não procura.
- **AQ-4. Auditoria:**
  - o valor de `events.action` do bloqueio (por exemplo, `login_blocked`), para o rótulo e o filtro;
  - onde ficam o motivo, o tipo de identificação, a identificação mascarada, o tipo e a duração do bloqueio (`error_reason` ou chaves estáveis em `metadata`). A tela lê pelas chaves;
  - a ligação ao cadastro (RN-15 b): hoje o `entity_id` dos eventos `auth` é o id do usuário do Auth, e o `entity_label` é nulo. A tela mostra o `entity_label` como "Cadastro". Defina um formato só para login, falha e bloqueio.
- **AQ-5. Máscara sobre a identificação já normalizada.** Hoje o `_mask_identifier` mascara o texto como foi digitado: `+55 (51) 98888-7777` vira `+*****************7`, e `(51) 98888-7777` vira `***7777`. Para quem audita juntar as tentativas na mesma identificação, a máscara precisa sair da forma normalizada, no mesmo padrão de hoje (RN-15).
- **AQ-6. Volume na Auditoria.** A tela lê os 500 eventos mais recentes, sem paginação. Num ataque, as falhas empurram os outros eventos para fora de "Todas". O filtro de ação roda no servidor, então quem audita ainda consegue ver cada tipo. Avalie paginar a Auditoria (fora deste passo) ou o volume da RN-15 (ponto 7 do Negócio).
- **AQ-7. `e2e/login.spec.ts`.** O `getByLabel("Senha")` compara por trecho do texto e também acha o botão "Mostrar senha" (`aria-label`), o que quebra o modo estrito do Playwright. O teste precisa passar a usar `getByLabel("Senha", { exact: true })`. As conferências do rótulo "Identificação" e do placeholder continuam.
- **AQ-8. Sobreposição com o PR 6 do E2.01.** Os textos e a tradução dos erros ficam num lugar só (`src/lib/auth/session.ts`, previsto no E2.01). Quem vier primeiro implementa a T1 deste spec, que já inclui a T10 ajustada. O registro do ajuste na T10 do E2.01 fica para quem atualizar aquele spec.

### Pendências para o PO (resolvidas em 2026-11-23)
Nenhuma bloqueava o desenho. O PO resolveu todas em 2026-11-23. As decisões estão em "Negócio > Decisões > Padrões definidos por este spec" (P-LOG-13 a P-LOG-16), nas RNs e em "Textos de tela". **Revisar no PR.**

- **PO-UX-1. Bloqueio sem contagem regressiva** (UXD-2). "Entrar" continua habilitado, a mensagem não muda sozinha e some depois de {N} minutos.
  - *Adotado.*
  - *Alternativa:* mostrar o horário de fim ("até as 21:55"), que não fica velho. Pede um texto novo e o horário do servidor na resposta.
  - ***Resolvida (PO):** aceito como está, sem mudança nas RNs.*
    - *A RN-12 pede só o {N}.*
    - *A RN-10 garante que tentar durante o bloqueio não aumenta o prazo, então o botão habilitado não prejudica ninguém e deixa livre o caminho de entrar com outra identificação.*
    - *A alternativa do horário de fim fica de fora: ela pediria o horário do servidor na resposta e um texto a mais.*
- **PO-UX-2. O indicador de tipo continua, com "CPF ou celular" na ambiguidade** (UXD-5). É um texto novo, que só descreve o formato, sem consultar o servidor.
  - *Adotado.*
  - *Alternativa:* tirar o indicador. A dica "CPF, celular ou e-mail" já diz o que vale, e a tela fica sem uma regra a mais para manter igual à do servidor.
  - ***Resolvida (PO):** aceito, e "CPF ou celular" entrou nos "Textos de tela".*
    - *O indicador segue as RN-02 a RN-04, que agora dizem também que o CPF com os 11 dígitos iguais não é válido (P-LOG-16, vindo da AQ-3).*
    - *Manter as duas implementações iguais é a AQ-3 do `architect`.*
- **PO-UX-3. "Mostrar senha"** (UXD-6). É um comportamento e um texto novos, sem regra de negócio. A senha começa oculta e volta a ficar oculta a cada envio.
  - *Adotado*, porque o limite de 5 tentativas torna o erro de digitação mais caro.
  - ***Resolvida (PO):** aceito, sem regra nova. "Mostrar senha" e "Ocultar senha" entraram nos "Textos de tela". A senha só aparece por escolha da pessoa e não sai do aparelho de outro jeito, então a RN-09 continua valendo.*
- **PO-UX-4. O que conta como vazio** (UXD-4). A identificação só com espaços é vazia, porque as pontas são ignoradas (RN-02). A senha só com espaços não é vazia, porque é usada como foi digitada (RN-09).
  - *Adotado*, como consequência das duas regras. Peço só a confirmação.
  - ***Resolvida (PO):** confirmado (P-LOG-13). A RN-08 passou a dizer isso explicitamente, também pela API. A RN-08 ganhou critérios para a identificação só com espaços e para a senha só com espaços.*
- **PO-UX-5. Textos da Auditoria** (marcados com † em Textos):
  - os nomes dos campos do painel e a segunda linha da descrição;
  - "{N} minutos" e "1 minuto" na duração;
  - o tipo **"CPF ou celular"**, quando a identificação de 11 dígitos foi procurada como os dois (por exemplo, "Identificação ambígua" ou "Identificação não encontrada"). O Negócio lista só E-mail, Celular e CPF;
  - em "Identificação inválida", o tipo não aparece.
  - *Adotado.*
  - ***Resolvida (PO):** aceito, com um ajuste no tipo "CPF ou celular" (P-LOG-15).*
    - *O ajuste: "CPF ou celular" aparece quando o número foi procurado como os dois e os dois caminhos levaram a algum cadastro (o mesmo ou cadastros diferentes), ou quando nenhum levou. Quando só um caminho encontrou o cadastro, o tipo é esse, CPF ou Celular.*
    - *Motivo: quase todo CPF válido também tem a forma de um celular de 11 dígitos. Pela regra proposta, quase todo login por CPF apareceria como "CPF ou celular", e quem audita perderia a informação.*
    - *A RN-15 ganhou a regra dos tipos e critérios para cada um.*
    - *Os campos do painel, a segunda linha, a duração e os tipos entraram nos "Textos de tela".*
    - *Na UX, só a linha "Auditoria: valores" de Textos foi ajustada para seguir a RN-15. O `ux-designer` pode revisar.*
- **PO-UX-6. Proposta, não adotada: aviso de formato antes de enviar.** Quando o indicador não reconhece nada (por exemplo, o celular sem DDD, `9888-7777`), a tela avisaria "Confira a identificação: use o CPF, o celular com DDD ou o e-mail." sem chamar a função e sem contar tentativa.
  - Isso evitaria bloqueios por um erro comum: esquecer o DDD. O aviso não revela nada, porque só olha o formato.
  - Muda a RN-07 (a) e a RN-08, que hoje mandam essa tentativa ao servidor e a contam como falha. Por isso, fica para decisão do PO.
  - ***Resolvida (PO): adotada** (P-LOG-14), com o texto proposto.*
    - *Motivo: esquecer o DDD é o erro mais provável de quem entra pelo celular, principalmente no primeiro acesso depois do cutover. Cada envio gastaria uma das 5 tentativas da RN-10. O aviso só olha o formato, como a conferência de campos vazios, e não revela nada sobre os cadastros.*
    - *Uma identificação com "@" é sempre enviada.*
    - *Pela API, nada muda: a identificação sem forma reconhecida continua sendo a falha (a) da RN-07 e conta para o limite, inclusive o da origem.*
    - *No Negócio, mudaram:*
      - *a RN-08, com o item "Formato não reconhecido";*
      - *a RN-07 (a), que agora só acontece pela API;*
      - *a definição de "falha de credencial" em Termos;*
      - *os critérios das RN-03, RN-07 e RN-08;*
      - *os "Textos de tela".*
    - *Na UX, só o necessário para refletir a decisão: a linha nova em Textos, o caso "Erro" em Estados, o UX-03 e o UX-19, que é novo. Na tela, o aviso segue o padrão dos campos vazios: mesmo espaço de mensagens, `AlertCircle`, `role="alert"` e foco na Identificação, sem limpar nada. Não há wireframe próprio. O `ux-designer` pode revisar.*

## Solução técnica
_Seção do `architect`. Escrita em 2026-11-23, só como desenho: nada foi implementado. **A implementação começa depois do PR 1 do E2.01 em produção** (ver [Ordem em relação ao E2.01](#ordem-em-relação-ao-e201))._

_Conferido em 2026-11-23:_
- _no código do Supabase Auth ([`supabase/auth`](https://github.com/supabase/auth), `master`): `internal/api/token.go` (login por senha), `verify.go`, `mail.go` (`adminGenerateLink`), `middleware.go` (`requireEmailProvider`, limites e `Sb-Forwarded-For`), `errors.go`, `internal/hooks/hookserrors` e `internal/tokens/service.go` (hook de token);_
- _nas docs do Supabase: [Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks), [Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook), [Rate limits](https://supabase.com/docs/guides/auth/rate-limits), [segredos das Edge Functions](https://supabase.com/docs/guides/functions/secrets), [Supabase Cron](https://supabase.com/docs/guides/cron/install) e [configuração do Auth pela Management API](https://supabase.com/docs/reference/api/v1-update-auth-service-config);_
- _na stack local `supabase_db_mci-e108-pr2`, só com leitura:_
  - _`events`, `event_action`, `log_auth_event`, `_mask_identifier` e `_log_event`;_
  - _colunas e índices de `members`, `auth.users` e `auth.one_time_tokens`;_
  - _o Vault, o `pg_cron` disponível e o `pgcrypto` em `extensions`;_
  - _os parâmetros de log (`log_statement = ddl`, `log_parameter_max_length_on_error = 0`);_
  - _o custo do bcrypt no `pgcrypto`: cerca de 45 ms com custo 10;_
- _no `mci-connect` (`origin/main`, `14ee75f`): `Login.tsx`, `AuthContext.tsx`, `Events.tsx`, `get-user-email`, `create-user-admin`, `config.toml`, os dois workflows de deploy, `e2e/login.spec.ts` e `e2e/dashboard.spec.ts`._

### Revisão das regras
Nenhuma RN precisou voltar ao PO. As lacunas técnicas foram resolvidas com a leitura mais conservadora e estão em [Definidas pelo architect](#definidas-pelo-architect-revisar-no-pr).

Casos de borda conferidos:
- **Fuso e virada de semana:** o login não depende da semana. Os prazos são `timestamptz` lidos com `clock_timestamp()` depois das travas. O bloqueio que começa no sábado às 23:55 termina no domingo às 00:10.
- **Casal:** o mesmo celular ou o mesmo e-mail nos dois cadastros cai na RN-05 (ambígua) até o E2.04. Cada um entra pelo próprio CPF ou e-mail.
- **Inativo, pastor, sem líder e sem função:** a busca e a conta não olham `is_active`, `is_pastor`, `leader_id` nem `role_id` (RN-06).
- **Excluído:** a busca ignora os excluídos para decidir (RN-05). Ela só olha para eles quando nada mais combinou, para registrar "Cadastro excluído" ligado ao cadastro (RN-15). A conta suspensa (DT-13 do E2.01) nunca tem a senha conferida.
- **Sem conta, ou conta apagada, banida, sem senha ou não confirmada:** um bcrypt fictício, a mesma resposta e o motivo certo na Auditoria (RN-07 e, f).
- **Consolidado (futuro):** a flag entra no primeiro estágio da busca, como "não encontrado" (ver [Pontos de extensão](#pontos-de-extensão)).
- **Concorrência:** as tentativas com a mesma identificação ou a mesma origem passam em fila, pela trava da linha de controle (ver [Contagem e bloqueio](#contagem-e-bloqueio-rn-10-a-rn-12)).
- **Volume:**
  - a busca usa três índices de expressão em `members`;
  - a tabela de controle guarda só chaves com falhas recentes e é limpa a cada 10 minutos.

Leituras técnicas. Nenhuma muda regra, mas o PO e o QA precisam saber delas:
1. **RN-14: o que fica de fora.** O caminho único desliga o provedor de e-mail e senha do Auth (DT-01). Com isso, o `/recover` padrão do Supabase (`resetPasswordForEmail`) também é recusado.
   - Hoje isso não muda nada, porque não existe recuperação.
   - O E1.07 vai precisar de uma função própria para a recuperação por e-mail (ver [Avaliação da RN-14](#avaliação-da-rn-14-caminho-único)).
2. **"No máximo 5 têm a senha conferida" (RN-10).** A 5ª tentativa tem a senha conferida.
   - Se a senha estiver certa, a pessoa entra e a contagem zera.
   - Se estiver errada, a resposta já é a mensagem de bloqueio.
3. **Número que pode ser CPF e celular.** Ele conta nas duas chaves, a do CPF e a do celular, e o bloqueio de qualquer uma vale para o número (DA-7). Senão, alternar `51988887704` e `+55 51 98888-7704` daria 10 tentativas ao mesmo celular.
4. **Tempo-limite do app (AQ-2).** Se a tela desiste depois de 20 s, a tentativa pode ter chegado ao servidor e contado. A tela mostra a mensagem de conexão (RN-08), mas a contagem não é desfeita (DA-10).
5. **O sucesso é mais lento que a falha.** Ele inclui a emissão da sessão, que são duas chamadas ao Auth. Isso não revela nada, porque o sucesso já é diferente pela resposta. O tempo igual da RN-07 vale entre as falhas.
6. **Sessão emitida por verificação.** O token de acesso sai com o método `otp` no `amr`, e não `password`. Nada no app usa isso (DA-11).

#### Definidas pelo architect (revisar no PR)
Pontos que as RNs não respondem por inteiro. O `architect` adotou a leitura mais conservadora. O usuário pode mudar qualquer um no PR.

| # | Ponto | Padrão adotado | Por quê |
|---|---|---|---|
| DA-1 | Origem desconhecida em produção (RN-11) | Sem um endereço válido no cabeçalho confiável, a tentativa é recusada como erro do servidor, sem contar. Fora do Supabase hospedado (stack local), vale `127.0.0.1`. | P-LOG-12: sem contar a origem, não há como cumprir a RN-11. Um cabeçalho ausente é mudança de infraestrutura, e o *smoke* de cada deploy pega. |
| DA-2 | Origem IPv6 (RN-11) | O endereço IPv6 conta pelo prefixo `/64`. O IPv4 conta pelo endereço. | Cada assinante de celular ou fibra recebe um `/64` inteiro. Contar por endereço daria 2^64 origens a quem tem um só acesso. |
| DA-3 | Corpo malformado pela API | JSON inválido ou campos que não são texto: a mesma resposta de campos vazios (400), sem contar e sem registrar. Corpo acima de 4 KB: 413, que a tela trata como erro do servidor. | A RN-08 só fala de campos vazios. A tela nunca manda nada disso. |
| DA-4 | Identificação longa | Acima de 254 caracteres, depois de tirar os espaços das pontas: "Identificação inválida", e a tentativa conta. | 254 é o maior e-mail válido. Assim nada enorme chega à busca. |
| DA-5 | Senha acima de 72 bytes | "Senha incorreta", com o mesmo bcrypt das outras tentativas. | O bcrypt só usa os primeiros 72 bytes, e o Auth não grava senha maior. Sem a regra, uma senha de 72 bytes aceitaria qualquer sufixo. |
| DA-6 | A identificação leva só a cadastros excluídos, mais de um | Motivo "Cadastro excluído", sem ligação a nenhum deles. | A RN-15 liga o registro só quando a identificação leva a um único cadastro. |
| DA-7 | Número que é CPF válido e tem a forma de um celular | Conta na chave do CPF e na do celular. O bloqueio de qualquer uma vale para o número. Um sucesso zera as duas. | RN-10: as formas que levam à mesma identificação não podem somar mais de 5 tentativas. |
| DA-8 | Ligação do bloqueio ao cadastro (UX T2) | O bloqueio por identificação fica ligado ao cadastro quando a falha que o disparou estava ligada. O bloqueio por origem nunca fica. | O bloqueio por origem não é de um cadastro, e ligá-lo induziria quem audita a erro. |
| DA-9 | Conta com hash de senha num formato que não é bcrypt | "Conta de acesso indisponível" (falha de credencial). Só `$2a$` conta como bcrypt: o `pgcrypto` trata `$2b$` como DES (o Auth grava `$2a$`). | RN-08: um erro que só acontece com um cadastro é falha de credencial. Uma mudança geral de formato aparece no *smoke*. |
| DA-10 | Tempo-limite do app | 20 s. A tentativa que chegou ao servidor conta, mesmo que a tela já tenha desistido. | O servidor não sabe que a tela desistiu (AQ-2). |
| DA-11 | Método da sessão | A sessão sai com `amr` = `otp`. | Consequência da DT-01. Nenhuma regra depende do método. |
| DA-12 | "Login realizado" sem sessão | O registro só é gravado depois que a sessão é emitida. Se a emissão falhar, não há registro, e a tela mostra o erro do servidor. | RN-15 (a): um registro por login, e login é receber a sessão. |
| DA-13 | Falha na emissão da sessão depois da senha certa | Uma nova tentativa. Se falhar de novo, o link pendente é descartado e a resposta é erro do servidor. A contagem da identificação já foi zerada. | A senha estava certa. O erro do servidor não conta (RN-08). |

### Avaliação da RN-14 (caminho único)
O pedido era recusar o login com senha direto no Auth sem quebrar a renovação da sessão. O que o plano gratuito permite:

| Opção | Disponível no plano gratuito? | Resultado |
|---|---|---|
| Hook *Password Verification Attempt* | **Não**. Só nos planos Team e Enterprise ([Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)). | Fora do plano. |
| Hook *Custom Access Token* recusando `authentication_method = 'password'` | Sim (Free e Pro). Ele roda em toda emissão de token, inclusive na renovação (`token_refresh`). | **Descartada.** O hook só roda depois que a senha foi conferida (`token.go`: a senha é conferida, depois vem `IssueRefreshToken`, que chama o hook). A recusa sai com `error_code` `unknown`, porque o erro de hook não tem código (`hookserrors.check` e `handleResponseErrorHTTP`). A senha errada sai com `invalid_credentials`. Quem chama o Auth direto descobre se a senha está certa, e os limites da RN-10 ficam de fora: é o oráculo que a RN-14 quer fechar. |
| Sessão assinada pela própria função (JWT e *refresh token* próprios) | — | **Descartada.** As chaves de assinatura novas ficam com o Supabase, e o *refresh token* exige linhas em `auth.sessions` e `auth.refresh_tokens`. |
| **Desligar o provedor de e-mail e senha** e emitir a sessão pela API de administração | Sim | **Adotada (DT-01).** |

**Como a opção adotada funciona** (conferido no código do Auth):
- Com `external_email_enabled = false`, o login por senha com e-mail é recusado **antes** de procurar o usuário (`token.go`, `ResourceOwnerPasswordGrant`: `422 email_provider_disabled`, "Email logins are disabled"). A resposta e o tempo são iguais para qualquer e-mail, com qualquer senha. Não sobra oráculo.
- Também ficam recusados `/otp`, `/magiclink`, `/resend` e `/recover` (`requireEmailProvider`). O cadastro público já está desligado.
- **Continuam funcionando:**
  - `/token?grant_type=refresh_token`, a renovação, que não consulta o provedor (RN-13, RN-14);
  - `/logout`;
  - `/verify`;
  - as rotas de administração (`/admin/users`, `/admin/generate_link`): a `create-user-admin` e a `change-member-password` não mudam;
  - `PUT /user`.
- **A sessão:**
  - depois de conferir a senha no banco (DT-02), a `sign-in` chama `auth.admin.generateLink({ type: 'magiclink', email })` com o e-mail da conta;
  - para um usuário que existe, isso só cria um *token* de uso único, sem mandar e-mail (`mail.go`);
  - em seguida, a função chama `POST /auth/v1/verify` com `{ type: 'email', token_hash }`, que emite uma sessão normal (`verify.go`, `verifyPost` e depois `issueRefreshToken`);
  - o `/verify` recusa conta banida, e a `sign-in` só chega lá com a conta disponível (RN-06 b).

**O que fica de fora:**
- **Recuperação de senha padrão** (`/recover`, `resetPasswordForEmail`) e os botões "Send password recovery" e "Send magic link" do painel do Supabase.
  - A RN-14 não proíbe a recuperação, mas este mecanismo a desliga junto.
  - O E1.07 precisa de uma Edge Function própria: `generateLink({ type: 'recovery' })` e envio pelo SMTP. O `/verify` e o `PUT /user`, que o link usa, continuam funcionando.
  - Hoje não há regressão, porque ainda não existe recuperação.
- **Método da sessão:** `otp` em vez de `password` (DA-11).
- **Registros do próprio Auth:** cada login gera `user_recovery_requested` e `login` no `auth.audit_log_entries`. Isso não aparece na Auditoria do app.

### Visão geral
```
Tela ─ POST /functions/v1/sign-in { identifier, password } (chave pública) ─▶ sign-in (Edge Function)
  1. corpo: campos vazios → 400, sem contar nem registrar (RN-08)
  2. origem = IP do cliente, do cabeçalho confiável (DT-06)
  3. rpc sign_in_attempt(identifier, password, origem)   ← uma transação no banco (DT-02):
       trava as chaves (identificação e origem) → bloqueio vigente? → busca → conta →
       ponto do E3.02 → um bcrypt → zera ou soma a falha → Auditoria da falha e do bloqueio
  4a. invalid ou locked → espera o piso (DT-07) → 401 ou 429
  4b. ok → generateLink(magiclink) + POST /auth/v1/verify (Sb-Forwarded-For) → sessão
        → rpc sign_in_record_login → 200 { session }
Tela ─ supabase.auth.setSession(session) ─▶ Dashboard
```

Quatro partes:
1. **Banco:** normalização e busca, controle de tentativas, conferência da senha e Auditoria. Tudo numa RPC só, `SECURITY DEFINER`, que só a *service role* chama.
2. **Edge Function `sign-in`:** recebe o pedido, descobre a origem, chama a RPC, emite a sessão e iguala o tempo das falhas.
3. **Configuração do Auth em produção** (Management API, fora das migrations): o provedor de e-mail e senha é desligado, o encaminhamento do IP é ligado e o limite de verificações sobe.
4. **Front:** a tela T1, a Auditoria T2 e o `AuthContext` usando só a `sign-in`.

### Modelo de dados e migrations

#### Ordem das migrations
Os nomes são sugestões; o timestamp é o do momento da criação.
- Cada arquivo é idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DO` com guarda) e roda num banco zerado depois das existentes e das do E2.01.
- Depois de cada PR com migration, regenere o `types.ts`.

| # | PR | Arquivo | Conteúdo | Por que separado |
|---|---|---|---|---|
| 1 | 1 | `<ts>_e104_01_enum.sql` | `ALTER TYPE public.event_action ADD VALUE IF NOT EXISTS 'login_blocked'` | Um valor novo de enum não pode ser usado na transação que o cria (padrão de Escolas e do E2.01) |
| 2 | 1 | `<ts>_e104_02_sign_in.sql` | Guarda de pré-requisito; funções de normalização; índices de busca; `private.sign_in_throttle`; chave no Vault; funções internas; as três RPCs; `pg_cron` e o job de limpeza; grants | Uma unidade de revisão: tudo o que a função usa |
| 3 | 3 | `<ts>_e104_04_log_auth_event_logout_only.sql` (o número 03 ficou com a migration do PR 1b) | `log_auth_event` passa a aceitar só `logout` | Só depois que o front novo estiver no ar. Antes disso, o front antigo ainda registra o login pelo cliente, e recusar criaria um buraco na Auditoria |

#### DDL de referência (migration 2)
```sql
-- 0. Pré-requisito: PR 1 do E2.01 (members.deleted_at, schema private, normalize_email e
--    normalize_digits da DT-17). Falha cedo, sem mudar nada.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'deleted_at')
     OR to_regnamespace('private') IS NULL
     OR to_regprocedure('public.normalize_email(text)')  IS NULL
     OR to_regprocedure('public.normalize_digits(text)') IS NULL THEN
    RAISE EXCEPTION 'E1.04 depende do PR 1 do E2.01 (deleted_at, schema private, normalize_*).';
  END IF;
END $$;

-- 1. Normalização (RN-02 a RN-04, DT-08). Imutáveis; o E2.04 reaproveita nos índices únicos.
--    Celular: zeros à esquerda fora; 55 fora só com 12 ou 13 dígitos; sobra 10 ou 11, senão NULL.
CREATE OR REPLACE FUNCTION public.normalize_mobile(_value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT CASE WHEN length(n) IN (10, 11) THEN n END
    FROM (SELECT CASE WHEN length(z) IN (12, 13) AND left(z, 2) = '55' THEN substr(z, 3) ELSE z END AS n
            FROM (SELECT ltrim(coalesce(public.normalize_digits(_value), ''), '0') AS z) a) b
$$;
-- Chave do 9º dígito (RN-03 e): 11 dígitos com 9 depois do DDD ≡ os mesmos 10 dígitos sem o 9.
CREATE OR REPLACE FUNCTION public.mobile_match_key(_value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT CASE WHEN length(m) = 11 AND substr(m, 3, 1) = '9' THEN left(m, 2) || substr(m, 4) ELSE m END
    FROM (SELECT public.normalize_mobile(_value) AS m) a
$$;
-- public.is_valid_cpf(_digits text) RETURNS boolean: exatamente 11 dígitos, nem todos iguais,
--   dígitos verificadores corretos (RN-04, P-LOG-16). Recebe só dígitos; qualquer outra coisa é false.
-- public.is_placeholder_email(_email text) RETURNS boolean: o domínio de normalize_email(_email)
--   está na lista de domínios fictícios. Hoje: 'mci12fakemail.com'. O E1.06 acrescenta o da D7.

-- 2. Índices da busca (RN-01, ponto 6 do PO). Sem predicado: o segundo estágio procura excluídos.
CREATE INDEX IF NOT EXISTS members_login_email_idx  ON public.members (public.normalize_email(email));
CREATE INDEX IF NOT EXISTS members_login_cpf_idx    ON public.members (public.normalize_digits(cpf));
CREATE INDEX IF NOT EXISTS members_login_mobile_idx ON public.members (public.mobile_match_key(mobile_whatsapp));

-- 3. Controle de tentativas (RN-10 a RN-12; DT-03, DT-04). Nada em claro: key_hash é HMAC-SHA256.
CREATE TABLE IF NOT EXISTS private.sign_in_throttle (
  kind          text          NOT NULL CHECK (kind IN ('identifier', 'origin')),
  key_hash      bytea         NOT NULL,
  failures      timestamptz[] NOT NULL DEFAULT '{}',   -- falhas dos últimos 15 min; no máximo o limite
  blocked_until timestamptz,
  expires_at    timestamptz   NOT NULL,                -- quando a linha pode ser apagada
  PRIMARY KEY (kind, key_hash),
  CHECK (cardinality(failures) <= 100)   -- teto folgado: os limites de verdade são constantes da sign_in_attempt (risco 16)
);
CREATE INDEX IF NOT EXISTS sign_in_throttle_expires_at_idx ON private.sign_in_throttle (expires_at);
ALTER TABLE private.sign_in_throttle ENABLE ROW LEVEL SECURITY;     -- sem políticas
REVOKE ALL ON TABLE private.sign_in_throttle FROM PUBLIC, anon, authenticated, service_role;

-- 4. Chave do HMAC no Vault, gerada no próprio banco e nunca exposta (DT-04).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'sign_in_throttle_key') THEN  -- o postgres não lê vault.secrets direto (tarefa 1)
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
                                'sign_in_throttle_key', 'E1.04: HMAC das chaves do limite de tentativas');
  END IF;
END $$;

-- 5. Limpeza (RN-11: origem guardada no máximo 24 h; na prática, menos de 45 min).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
-- private.sign_in_purge(): DELETE das linhas com expires_at < now(), escolhidas com
--   FOR UPDATE SKIP LOCKED (não espera nem trava uma tentativa em andamento).
SELECT cron.schedule('e104-sign-in-purge', '*/10 * * * *', 'SELECT private.sign_in_purge()');
```

**Funções internas** (`private`, `SECURITY INVOKER`, `SET search_path = public`, sem grants). Elas rodam dentro da RPC *definer*, com os privilégios do dono dela, ou pelo `pg_cron`, como `postgres`:

| Função | O que faz |
|---|---|
| `private.parse_login_identifier(_raw text)` | Devolve `format` (`empty`, `email`, `cpf`, `mobile`, `cpf_or_mobile` ou `invalid`), `email`, `cpf`, `mobile`, `mobile_key` e `masked`. Regras das RN-02 a RN-04 e DA-4. É a gêmea do `classifyIdentifier` da tela (AQ-3). |
| `private.sign_in_key(_kind text, _value text) RETURNS bytea` | `extensions.hmac(_kind \|\| ':' \|\| _value, <chave do Vault>, 'sha256')`. Sem a chave, dá erro, e a tentativa vira erro do servidor (P-LOG-12). |
| `private.sign_in_origin_key(_origin inet) RETURNS text` | IPv4: `host(_origin)`. IPv4 mapeado (`::ffff:a.b.c.d`): o IPv4. Outro IPv6: `network(set_masklen(_origin, 64))::text` (DA-2, DT-06). |
| `private.sign_in_lookup(_p ...)` | A busca em dois estágios ([Busca pelo cadastro](#busca-pelo-cadastro-rn-01-a-rn-06)). Devolve `outcome`, `member_id`, `member_name` e `identifier_type`. |
| `private.sign_in_check_legacy(_member_id uuid, _password text) RETURNS text` | Ponto do E3.02 (RN-17 b). Neste passo, devolve sempre `NULL`, que quer dizer "não se aplica". |
| `private.sign_in_purge()` | A limpeza do item 5 |
| `private.sign_in_assert_duration(_max interval)` | O teto da DT-19, chamado antes de cada `RETURN` da `sign_in_attempt` |

**RPCs** (`public`, `SECURITY DEFINER`, `SET search_path = public`):
- `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` e `GRANT EXECUTE … TO service_role`. Os privilégios padrão do Supabase dão EXECUTE a `anon` em toda função nova de `public`, então o `REVOKE` é obrigatório.

| RPC | Quem chama | Efeito |
|---|---|---|
| `sign_in_attempt(_identifier text, _password text, _origin text) RETURNS jsonb` | a `sign-in` | A decisão inteira, numa transação ([Contagem e bloqueio](#contagem-e-bloqueio-rn-10-a-rn-12)). Também tem `SET lock_timeout = '3s'`. |
| `sign_in_record_login(_member_id uuid, _auth_user_id uuid, _identifier_type text, _identifier_masked text) RETURNS void` | a `sign-in`, depois de emitir a sessão | Confere que o cadastro é dessa conta e grava "Login realizado" (RN-15 a, DA-12) |
| `sign_in_discard_link(_auth_user_id uuid) RETURNS void` | a `sign-in`, quando a emissão falha | Apaga o *token* pendente da conta (`auth.one_time_tokens`, tipo `recovery_token`) e limpa `auth.users.recovery_token` (DA-13, risco 9) |

**Funções públicas novas, de normalização:** `normalize_mobile`, `mobile_match_key`, `is_valid_cpf` e `is_placeholder_email`.
- São `IMMUTABLE`, com EXECUTE para `authenticated` e `service_role` e sem `anon`, como as `normalize_*` do E2.01. Elas aparecem em índices de `members`.

#### Integridade e privilégios
| Garantia | Como |
|---|---|
| Ninguém conta, consulta nem limpa as tentativas pela API | `private` fora dos *Exposed schemas* (E2.01); tabela com RLS sem políticas e sem privilégios, inclusive para `service_role` |
| Só a `sign-in` decide um login | As RPCs só têm EXECUTE para `service_role` |
| Nenhum dado pessoal em claro na tabela de controle | `key_hash` é HMAC com uma chave que fica no Vault; a origem e a identificação nunca são gravadas |
| A origem some em até 24 horas | `expires_at` mais o job de 10 em 10 minutos. Na prática, nenhuma linha passa de cerca de 45 minutos. |
| No máximo 5 (ou 20) senhas conferidas por janela | Trava da linha da chave antes da conferência ([Contagem e bloqueio](#contagem-e-bloqueio-rn-10-a-rn-12)) |
| Ninguém entra com senha direto no Auth | Provedor de e-mail e senha desligado (DT-01); o "Deploy: banco" confere a cada execução (PR 3) |

### Busca pelo cadastro (RN-01 a RN-06)
1. **Leitura da identificação** (`parse_login_identifier`, a mesma tabela de casos da tela):
   - Tira os espaços das pontas. Vazia: campos vazios. Acima de 254 caracteres: inválida (DA-4).
   - Com "@": só e-mail, por `normalize_email`.
   - Sem "@", só os dígitos contam:
     - é **CPF** se tiver exatamente 11 dígitos, sem tirar zeros, e passar em `is_valid_cpf`;
     - é **celular** se `normalize_mobile` não for nulo; a chave é `mobile_match_key`;
     - pode ser os dois ou nenhum; nenhum é inválida.
2. **Primeiro estágio: só cadastros não excluídos** (`deleted_at IS NULL`), pelos índices:
   - **E-mail:** `normalize_email(m.email) = e-mail digitado`.
     - Um e-mail digitado com domínio fictício (`is_placeholder_email`) não é procurado: vale como não encontrado (RN-01).
     - O e-mail fictício gravado no cadastro nunca combina com um e-mail real.
   - **CPF:** `normalize_digits(m.cpf) = CPF digitado`.
   - **Celular:**
     - primeiro, os cadastros com `mobile_match_key(m.mobile_whatsapp) = chave` e `normalize_mobile(m.mobile_whatsapp) = celular digitado` (exato);
     - só se não houver nenhum exato, todos com a mesma chave (9º dígito, RN-03 e).
   - **Resultado:** a união dos ids dos caminhos usados.
     - 1 cadastro: segue;
     - 2 ou mais: `ambiguous`;
     - nenhum: vai para o segundo estágio.
     - O CPF e o celular do mesmo cadastro contam como um (caso de Ulisses).
3. **Segundo estágio: só excluídos**, com as mesmas consultas, só para o motivo (RN-07 d, RN-15):
   - 1 excluído: `member_deleted`, ligado a ele;
   - 2 ou mais: `member_deleted`, sem ligação (DA-6);
   - nenhum: `not_found`.
4. **Tipo de identificação** (RN-15, P-LOG-15), olhando o estágio que decidiu:
   - `email` com "@";
   - sem "@", quando o número só podia ser CPF ou só celular, o tipo é esse;
   - quando era os dois:
     - se só um dos caminhos encontrou cadastro, o tipo é o desse caminho;
     - se os dois encontraram, ou nenhum, o tipo é `cpf_or_mobile`;
   - na identificação inválida, não há tipo.
5. **Conta de acesso** do cadastro único não excluído. Lida de `auth.users`, sem trava:
   - `auth_user_id` nulo: `no_account`;
   - `account_unavailable` em qualquer um destes casos:
     - a conta não existe;
     - `deleted_at` preenchido (exclusão do próprio Auth);
     - `banned_until > now()`;
     - `email_confirmed_at` nulo (o `/verify` confirmaria o e-mail sozinho, então a recusa é aqui);
     - `encrypted_password` nulo, vazio ou fora do formato bcrypt (DA-9);
     - `is_sso_user` ou `is_anonymous`.

| Código (`metadata.reason`) | Quando | Motivo na Auditoria | Ligado ao cadastro |
|---|---|---|---|
| `invalid_identifier` | Sem "@" e sem a forma de CPF nem de celular, ou acima de 254 caracteres (só pela API) | Identificação inválida | não |
| `not_found` | Nada nos dois estágios, ou e-mail fictício | Identificação não encontrada | não |
| `ambiguous` | 2 ou mais cadastros não excluídos | Identificação ambígua | não |
| `member_deleted` | Só excluídos | Cadastro excluído | se for um só |
| `no_account` | Cadastro único sem conta | Sem conta de acesso | sim |
| `account_unavailable` | Conta ausente, apagada, banida, suspensa, não confirmada ou sem senha bcrypt | Conta de acesso indisponível | sim |
| `wrong_password` | Senha que não confere (inclusive DA-5) | Senha incorreta | sim |

### Contagem e bloqueio (RN-10 a RN-12)
**Chaves.** Cada tentativa tem uma ou duas chaves de identificação e uma de origem:
- **Identificação:**
  - `e:<e-mail normalizado>`;
  - `c:<11 dígitos>`;
  - `m:<mobile_match_key>`;
  - `x:<texto minúsculo, sem espaços nas pontas>` para a identificação inválida.

  Um número que é CPF e celular tem as chaves `c:` e `m:` (DA-7). As formas que as RN-02 a RN-04 tratam como iguais dão a mesma chave.
- **Origem:** `o:<IPv4 ou prefixo /64>` (DA-2).

Cada chave vira uma linha `(kind, key_hash)` com `key_hash = sign_in_key(kind, chave)`.

**Algoritmo**, todo dentro da `sign_in_attempt`, numa transação:
1. **Campos vazios:** devolve `empty_fields`, sem tocar em nada.
2. **Travas, sempre antes de conferir a senha.**
   - Para cada chave, na ordem `(kind, key_hash)`: `INSERT … ON CONFLICT (kind, key_hash) DO UPDATE SET kind = EXCLUDED.kind RETURNING *`. Isso cria a linha ou trava a que já existe.
   - Como todas as chamadas travam na mesma ordem, não há *deadlock* entre tentativas.
   - A limpeza usa `SKIP LOCKED` e nunca espera.
3. **Bloqueio vigente** (`blocked_until > clock_timestamp()` em qualquer linha):
   - devolve `locked`, com o maior prazo restante (RN-12);
   - não confere a senha, não soma falha, não estende o bloqueio e não registra nada (RN-10, RN-11, RN-15 c).

   Uma linha com o bloqueio vencido volta a zero (RN-12).
4. **Janela deslizante:** antes de contar, saem de `failures` os horários com mais de 15 minutos.
5. **Busca, conta, ponto do E3.02 e um bcrypt** ([Tempo igual](#tempo-igual-rn-07-e-p-log-04)).
6. **Sucesso:**
   - as linhas de identificação voltam a `failures = '{}'` e `blocked_until = NULL`;
   - a linha da origem não muda (RN-11);
   - a resposta leva `member_id`, `auth_user_id`, o e-mail da conta, o tipo, a identificação mascarada e `password_action: null` (este último é do E3.02).
7. **Falha:**
   - o horário entra em `failures` de **todas** as linhas: identificação e origem;
   - quando uma linha de identificação chega a 5, ou a da origem chega a 50, ela recebe `blocked_until = agora + 15 min`, e `failures` volta a `'{}'`;
   - `expires_at = greatest(agora + 15 min, blocked_until)`.

   A resposta é `locked` (15 minutos) se esta falha disparou algum bloqueio, e `invalid` nos outros casos.
8. **Auditoria da falha e dos bloqueios** num sub-bloco `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING … END`. Se a gravação falhar, a resposta não muda (P-LOG-12, RN-15 g). O `WARNING` traz só o `SQLSTATE`.

Qualquer erro antes do item 8 (trava que esperou mais de 3 s, Vault, origem inválida) desfaz a transação inteira. A `sign-in` responde com o erro do servidor, e nada foi contado nem revelado (RN-08, P-LOG-12).

**Concorrência** (critérios das RN-10 e RN-11):
- **20 tentativas ao mesmo tempo com o CPF de Ana:** elas passam em fila pela linha `c:`. As 5 primeiras têm a senha conferida, e a 5ª dispara o bloqueio. As outras 15 encontram o bloqueio e recebem `locked` sem conferir nada.
- **Mesma origem:** as tentativas também passam em fila pela linha `o:`. O custo é a espera de cerca de um bcrypt por tentativa à frente (risco 4).
- **Login durante a exclusão do mesmo membro (E2.01):** a busca não trava `members` nem `auth.users`.
  - Se a exclusão vem antes, a busca encontra o cadastro excluído.
  - Se vem depois, a emissão da sessão esbarra no banimento (`/verify` recusa) ou a sessão é apagada pela suspensão. O banco já ignora o excluído (DT-04 do E2.01).

### Tempo igual (RN-07 e P-LOG-04)
- **Exatamente um bcrypt, do mesmo custo, em toda tentativa que não está bloqueada:**
  - conta disponível: `extensions.crypt(_password, encrypted_password)`;
  - qualquer outro caso (inválida, não encontrada, ambígua, excluída, sem conta, conta indisponível): `extensions.crypt(_password, '<sal fixo com o custo de produção>')`.

  As 5 contas de produção usam `$2a$10$` (tarefa 1): o sal fixo é `$2a$10$` + 22 caracteres.
- **Piso de 700 ms** (`FAILURE_FLOOR_MS`) para as respostas 401 e 429, contado da chegada do pedido à função. O piso absorve o que sobra: duas consultas a mais, a gravação da Auditoria e as variações de carga.
  - A tarefa 4 mede o p99 de cada caso na stack local.
  - Se algum caso passar do piso, o piso sobe. O critério é o da RN-07: a mediana de cada caso a menos de 100 ms da de "senha errada".
- **O E3.02 herda a regra.** Para quem tem credencial legada, o bcrypt do `md5` **substitui** o bcrypt da conta, em vez de somar. Assim, cada tentativa continua com um bcrypt só. A credencial legada usa o mesmo custo (decisão do E3.01).
- O bloqueio (429) não confere senha para ninguém. Ele tem o mesmo tempo para qualquer identificação e também respeita o piso.

### Origem confiável (RN-11)
- A origem vem só de um cabeçalho que o cliente não consegue forjar. O corpo do pedido nunca informa a origem.
- **Regra (DT-06, pela sonda da tarefa 1):** a origem é o `CF-Connecting-IP`, e nada mais.
  - Nas Edge Functions, o Cloudflare preenche esse cabeçalho com o IP do cliente e **recusa** o pedido que o traz forjado (HTTP 403).
  - **`X-Forwarded-For` não serve, nem o primeiro nem o último valor.** O *gateway* descarta o XFF do cliente, mas o último valor é um salto interno da AWS que muda a cada pedido. O primeiro valor e o `Sb-Forwarded-For` de entrada batem com o `CF-Connecting-IP`; ficam fora para haver uma fonte só, sem conferência cruzada que derrubaria logins sem ganho.
  - **`True-Client-IP`, `Forwarded` e `X-Real-IP` nunca são lidos:** os dois primeiros passam como o cliente mandou.
- **Normalização** (`client-ip.ts`, repetida na `sign_in_origin_key`):
  - IPv4 mapeado em IPv6 (`::ffff:a.b.c.d`) vira o IPv4. Sem isso, todo IPv4 mapeado cairia no mesmo `/64` e dividiria uma origem só;
  - IPv6 conta pelo `/64` (DA-2). Hoje o `*.supabase.co` não tem AAAA e todos chegam por IPv4; o `/64` fica como defesa.
- **Ambiente** (DA-1): a função é "local" só se o host de `SUPABASE_URL` for `kong`, `localhost`, `127.0.0.1` ou `host.docker.internal`. Qualquer outro host conta como hospedado (falha fechada).
  - Hospedado, sem `CF-Connecting-IP` válido: erro do servidor.
  - Local: vale o `CF-Connecting-IP` se vier válido (o QA testa a origem de ponta a ponta), senão `127.0.0.1`.
- A regra fica num módulo puro, `supabase/functions/sign-in/lib/client-ip.ts`, com testes. Se o Supabase sair do Cloudflare, o cabeçalho some, todo login dá erro e o *smoke* pega; o plano B é o `Sb-Forwarded-For` de entrada, depois de nova sonda (risco 6). A validação final é o `::inet` dentro da RPC.

### A função `sign-in`
**Arquivos:**
- `supabase/functions/sign-in/index.ts`: o *handler*, em Deno, com o `supabase-js` do `esm.sh`, como as outras funções;
- `lib/client-ip.ts` e `lib/http.ts`: módulos puros, sem Deno nem importação remota, testados pelo Vitest. O `vitest.config.ts` passa a incluir `supabase/functions/**/lib/*.test.ts`.

```ts
// supabase/functions/sign-in/index.ts (esqueleto)
serve(async (req) => {
  const startedAt = performance.now()
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') return reply(405, { result: 'server_error' })
  const body = await readJsonBody(req, 4096)                    // > 4 KB: 413; JSON inválido: null (DA-3)
  const identifier = typeof body?.identifier === 'string' ? body.identifier : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (identifier.trim() === '' || password === '') return reply(400, { result: 'empty_fields' })

  const origin = clientIpFrom(req.headers, { hosted: isHosted(Deno.env.get('SUPABASE_URL')) })  // DT-06
  if (!origin) return reply(500, { result: 'server_error' })   // DA-1

  const { data, error } = await admin.rpc('sign_in_attempt', { _identifier: identifier, _password: password, _origin: origin })
  if (error || !isAttemptResult(data)) return reply(500, { result: 'server_error' })

  switch (data.result) {
    case 'empty_fields': return reply(400, { result: 'empty_fields' })
    case 'invalid':
      await waitForFloor(startedAt)
      return reply(401, { result: 'invalid_credentials' })
    case 'locked':
      await waitForFloor(startedAt)
      return reply(429, { result: 'locked', retry_after_minutes: data.retry_after_minutes },
                   { 'Retry-After': String(data.retry_after_seconds) })
    case 'ok': {
      const session = await mintSession(data.auth_user_id, data.auth_email, origin)  // DA-13
      if (!session) return reply(500, { result: 'server_error' })
      await recordLogin(data)                                    // erro ignorado (P-LOG-12)
      return reply(200, { result: 'ok', session })
    }
  }
})
```

**Emissão da sessão** (`mintSession`):
1. `admin.auth.admin.generateLink({ type: 'magiclink', email: auth_email })`.
   - Recusa se `data.user.id !== auth_user_id` ou se `data.properties.verification_type !== 'magiclink'`.
   - Se o e-mail não existisse mais no Auth, o `generateLink` criaria um usuário novo (`mail.go`). Nesse caso, a função apaga esse usuário recém-criado.
2. `POST {SUPABASE_URL}/auth/v1/verify` com `{ type: 'email', token_hash: data.properties.hashed_token }`, a **chave secreta nova** (`apikey` vinda de `SUPABASE_SECRET_KEYS`) e `Sb-Forwarded-For: <origem>`.
3. Com `otp_expired`, que acontece quando outro login da mesma conta trocou o *token* no meio, repete os passos 1 e 2 uma vez. Se falhar de novo, chama `sign_in_discard_link` e devolve `null` (DA-13).
4. Devolve só `access_token`, `refresh_token`, `expires_in`, `expires_at` e `token_type`. O objeto `user` do Auth não volta para a tela (RN-13).

**Chaves e configuração:**
- A função usa a chave secreta nova (`JSON.parse(SUPABASE_SECRET_KEYS).default`) para a RPC, a administração e o `/verify`.
  - O `Sb-Forwarded-For` só vale com a chave secreta nova ([Rate limits](https://supabase.com/docs/guides/auth/rate-limits)).
  - Em produção, sem essa chave, a função responde com o erro do servidor. Fora do Supabase hospedado, ela pode usar a `SUPABASE_SERVICE_ROLE_KEY`.
- `verify_jwt = false` no `config.toml` (ponto 9 do PO). A tela chama a função só com a chave pública, que não é um JWT, como faz hoje com a `get-user-email`.
- `Cache-Control: no-store` em todas as respostas. CORS como nas outras funções (`*`, só `POST` e `OPTIONS`): a resposta não usa cookies.
- **Logs:** só o `result`, o tempo e o código de erro interno. Nunca a identificação, a senha, o e-mail da conta, o *token* nem a origem (RN-09, RN-15 d). O `email_otp` que o `generateLink` devolve é descartado.

**Limites do próprio Auth** (ponto 2 do PO):

| Limite do Auth | Padrão | Como fica |
|---|---|---|
| `/token` (senha e renovação), por IP | 150 a cada 5 min | O login por senha deixa de existir. A renovação continua saindo do navegador de cada pessoa, com o IP dela. Sem mudança. |
| `/verify`, por IP | 30 a cada 5 min | Uma chamada por login com sucesso, com `Sb-Forwarded-For`, então o limite passa a ser **por pessoa (IP do cliente)**. Sobe para 150 a cada 5 min (`rate_limit_verify`), para aguentar a rede da igreja no dia do cutover. As falhas não chegam ao Auth: o limite delas é o da RN-10 e da RN-11. |
| `/admin/generate_link` | sem limite | — |
| Sem o `Sb-Forwarded-For` ligado | — | Todos os logins dividiriam o limite de `/verify` pelo IP da Edge Function, cerca de 6 por minuto. É o risco 7, e a implantação liga o encaminhamento antes do promote. |

### Auditoria (RN-15)
Formato único para os eventos de autenticação (AQ-4). O `entity` é sempre `auth`.

| Situação | `action` | `actor_user_id` | `entity_id` / `entity_label` | `description` | `success` | `error_reason` | `metadata` |
|---|---|---|---|---|---|---|---|
| Login realizado | `login` | a conta que entrou | o cadastro / nome dele | Login realizado | true | — | `identifier_type`, `identifier_masked` |
| Falha no login | `login_failed` (já existe) | nulo | o cadastro, quando ligado (tabela de motivos) | Falha no login | false | o motivo em pt-BR | `identifier_type` (sem ele na inválida), `identifier_masked`, `reason` |
| Bloqueio | `login_blocked` (**novo**) | nulo | o cadastro, no bloqueio por identificação ligado (DA-8) | Login bloqueado por excesso de tentativas | false | — | `block_scope` (`identifier` ou `origin`), `block_minutes` (15) e, por identificação, `identifier_type` e `identifier_masked` |
| Logout | `logout` | como hoje | como hoje | como hoje | true | — | como hoje |

- **Chaves estáveis** (a tela lê por elas):
  - `identifier_type`: `email`, `mobile`, `cpf` ou `cpf_or_mobile`;
  - `reason`: os códigos da tabela de motivos;
  - `block_scope`: `identifier` ou `origin`;
  - `block_minutes`: número.

  O `error_reason` traz o mesmo motivo em pt-BR, para quem lê o evento sem a tela.
- **Gravação:** a falha e o bloqueio são gravados pela `sign_in_attempt`, e o login pela `sign_in_record_login`, todos via `_log_event`. Sem sessão, `auth.uid()` é nulo, e o autor fica "—".
- **Um evento por bloqueio:** um por tipo de bloqueio que a falha disparou. As tentativas recusadas durante o bloqueio não geram nada (RN-15 c).
- **Máscara sobre a forma normalizada** (AQ-5). Ela é calculada em `parse_login_identifier`:
  - e-mail normalizado: a primeira letra, `***@` e o domínio;
  - CPF, celular ou CPF ou celular: `***` e os 4 últimos dígitos (iguais em todas as formas do mesmo número);
  - identificação inválida: só `***`, sem nenhum caractere da entrada nem o tamanho (decisão do usuário em 2026-11-24, risco 17: quem cola a senha no campo de identificação não pode ter caracteres dela na Auditoria).

  A origem nunca entra na Auditoria (RN-15 d).
- **Eventos antigos:** os logins de antes deste passo têm `entity_id` igual ao id da conta e `entity_label` nulo. A tela só não mostra "Cadastro" para eles.
- **`log_auth_event`:** a migration 3 (PR 3) aceita só `logout` e mantém o filtro de excluídos do E2.01 (DA-9 de lá). Com isso, nenhum login pode ser forjado pelo cliente.
- **Volume** (AQ-6):
  - cada origem atacante gera no máximo 50 falhas e 1 bloqueio a cada 15 minutos, cerca de 204 eventos por hora;
  - cada identificação gera no máximo 5 falhas e 1 bloqueio a cada 15 minutos.

  Ver o risco 5.

### Contratos

**Edge Function `sign-in`** (`POST /functions/v1/sign-in`, só com a chave pública; AQ-1):

Corpo: `{ "identifier": string, "password": string }`

| HTTP | Corpo | Quando |
|---|---|---|
| 200 | `{ "result": "ok", "session": { "access_token", "refresh_token", "expires_in", "expires_at", "token_type" } }` | RN-13 |
| 400 | `{ "result": "empty_fields" }` | RN-08, P-LOG-13 e DA-3. Não conta nem registra. |
| 401 | `{ "result": "invalid_credentials" }` | Todos os casos da RN-07, inclusive a identificação inválida pela API. Corpo idêntico em todos. |
| 429 | `{ "result": "locked", "retry_after_minutes": N }`, mais o cabeçalho `Retry-After: <segundos>` | RN-10 a RN-12. `N` já vem arredondado para cima, no mínimo 1. |
| 500 | `{ "result": "server_error" }` | Erro do banco, do Auth, da contagem ou da origem (RN-08, P-LOG-12, DA-1). Não conta. |
| 405, 413 | `{ "result": "server_error" }` | Método errado ou corpo grande (DA-3). A tela nunca provoca. |

**RPC `sign_in_attempt`** (só `service_role`), que devolve `jsonb`:
- `{ "result": "empty_fields" }`;
- `{ "result": "locked", "retry_after_seconds": int, "retry_after_minutes": int }`;
- `{ "result": "invalid" }`;
- `{ "result": "ok", "member_id": uuid, "auth_user_id": uuid, "auth_email": text, "identifier_type": text, "identifier_masked": text, "password_action": null }`. O `password_action` é o ponto do E3.02: `null`, `"set"` ou `"set_random_and_flag"`.

**Enum:** `event_action` ganha `login_blocked`.

**Configuração do Auth em produção** (Management API, `PATCH /v1/projects/{ref}/config/auth`; confira os nomes no `GET` antes):

| Campo | Valor | Quando |
|---|---|---|
| `security_sb_forwarded_for_enabled` | `true` | Passo A, antes do promote do PR 2 |
| `rate_limit_verify` | `150` | Passo A |
| `external_email_enabled` | `false` | Passo B, logo depois do promote do PR 2 e do *smoke* |

**Configuração local** (`supabase/config.toml`, só para a stack local):
- `[auth.rate_limit] token_verifications = 1000` (PR 1);
- `[auth.email] enable_signup = false` (PR 2). É o `GOTRUE_EXTERNAL_EMAIL_ENABLED=false` da stack local ([supabase/cli#2053](https://github.com/supabase/cli/issues/2053)).

O comentário no arquivo diz que a produção é configurada pela Management API e que **nunca** se usa `supabase config push`.

### Front
Segue o padrão do E1.08 e do E2.01: os componentes cuidam da tela, o acesso a dados fica nos hooks, serviços e contextos, e a regra pura fica em `src/lib/`.

- **Domínio puro, com testes Vitest:**
  - `src/lib/auth/identifier.ts`:
    - `classifyIdentifier(raw)`, que devolve `'empty' | 'email' | 'mobile' | 'cpf' | 'cpf_or_mobile' | 'unknown'`;
    - `isValidCpf` e `normalizeMobile`, com as mesmas regras do banco;
    - os rótulos do indicador.

    Sai o `isValidCPF` de dentro do `Login.tsx`.
  - `supabase/tests/fixtures/login-identifier-cases.json`: a **única** tabela de casos (AQ-3). Ela tem a tabela da T1 e os critérios das RN-02 a RN-04 e da RN-15, com a entrada, o formato e as formas normalizadas.
    - O Vitest roda o `classifyIdentifier` sobre ela.
    - O pgTAP roda o `parse_login_identifier` sobre os mesmos casos. A tarefa 4 gera o SQL a partir do JSON, e um teste do Vitest falha se a cópia ficar desatualizada.
  - `src/lib/auth/session.ts`: **todos** os textos do login e o texto do bloqueio, `lockedMessage(minutes)`, com "1 minuto" no singular. O E2.01 acrescenta aqui o `shouldEndSession` (AQ-8).
  - `src/lib/auth/sign-in-result.ts`: `parseSignInResponse(status, body)`, que devolve uma união `ok | invalid_credentials | locked(minutes) | empty_fields | server_error`, com *type guards* e sem `any`. Qualquer resposta fora do contrato vira `server_error`.
  - `src/lib/audit/auth-events.ts`:
    - os rótulos de `reason`, `identifier_type` e `block_scope`;
    - a segunda linha da descrição;
    - os campos do painel (UX T2);
    - um *type guard* para o `metadata`. O `metadata: any` de `Events.tsx` sai.
- **Serviço:** `src/services/auth/sign-in.ts`, com `requestSignIn(identifier, password, { timeoutMs: 20_000 })`.
  - Faz um `fetch` em `${VITE_SUPABASE_URL}/functions/v1/sign-in`, com o cabeçalho `apikey`, para ler o status e o corpo sem depender do `FunctionsHttpError`.
  - Usa `AbortController` para o tempo-limite. Rede, tempo-limite e 5xx viram `server_error`.
- **`AuthContext`:**
  - `signIn` devolve o resultado tipado, sem exceção para falhas esperadas, e chama `supabase.auth.setSession(session)` no sucesso;
  - saem a chamada à `get-user-email`, o `signInWithPassword` e o `log_auth_event('login')`;
  - o `signOut` não muda.
- **`Login.tsx`:** a T1 inteira, que já inclui a T10 ajustada do E2.01.
  - A tela confere os campos vazios (UX-01) e o formato (UX-19) antes de enviar. O servidor repete as duas conferências.
  - O aviso de sessão encerrada aparece quando a navegação traz `state.reason === 'session_ended'`. Quem passa esse estado é o E2.01 (PR 6).
- **`Events.tsx`:** a T2. Entram "Login (bloqueio)" no `ACTION_LABELS`, a segunda linha e o painel, e o "OK" passa para `outline`.

### Onde cada regra é imposta
| RN | Banco e servidor | UI |
|---|---|---|
| RN-01 | `sign_in_lookup`: busca no cadastro, nunca pelo e-mail da conta; `is_placeholder_email`; excluídos só no segundo estágio | Indicador de tipo só pelo formato |
| RN-02 | `normalize_email` e o índice `members_login_email_idx`; com "@", só e-mail | `classifyIdentifier` |
| RN-03 | `normalize_mobile`, `mobile_match_key` e o índice; correspondência exata primeiro | `classifyIdentifier` e o aviso de formato (UX-19) |
| RN-04 | `is_valid_cpf` e `normalize_digits(cpf)` com índice; sem tirar zeros | `classifyIdentifier` |
| RN-05 | Contagem de ids distintos no primeiro estágio; excluídos fora | — |
| RN-06 | Conta conferida em `auth.users` (existe, não apagada, não banida, confirmada, com senha bcrypt); `/verify` recusa conta banida | — |
| RN-07 | Um corpo 401 para tudo; um bcrypt por tentativa; piso de 700 ms | A mensagem única de `session.ts` |
| RN-08 | `empty_fields` na função e na RPC, sem contar; erros desfazem a transação (500, sem contar); a identificação inválida pela API conta | Campos vazios (UX-01) e formato (UX-19) antes de enviar; mensagem de conexão |
| RN-09 | A senha vai da função para a RPC sem transformação e nunca é gravada nem registrada; `log_parameter_max_length_on_error = 0` | Nenhum hash no navegador |
| RN-10 | `private.sign_in_throttle`: chaves de identificação, trava antes da conferência, janela deslizante, bloqueio na linha, zerar no sucesso | Mensagem com {N} |
| RN-11 | Chave de origem (IPv4 ou `/64`), HMAC, cabeçalho confiável, limpeza pelo `pg_cron` | — |
| RN-12 | `retry_after_minutes` arredondado para cima e o maior prazo entre as chaves; não há RPC de desbloqueio; sessões abertas não são tocadas | Sem contagem regressiva; a mensagem some depois de {N} minutos |
| RN-13 | A função devolve só a sessão; renovação e saída intactas (o provedor não é consultado nelas) | `setSession` no `AuthContext` |
| RN-14 | `external_email_enabled = false` (Auth); conferência no "Deploy: banco" (PR 3) | O app chama só a `sign-in` |
| RN-15 | `sign_in_attempt` (falha e bloqueio) e `sign_in_record_login` via `_log_event`; `login_blocked`; máscara normalizada; `log_auth_event` só com `logout`; RLS de `events` como hoje | Rótulos, segunda linha e painel (T2) |
| RN-16 | PR 3: a pasta sai, o `config.toml` e a lista `EDGE_FUNCTIONS` também, e `EDGE_FUNCTIONS_REMOVED` apaga a função publicada | — |
| RN-17 | `sign_in_check_legacy` (ponto vazio), `password_action` no contrato, um bcrypt por tentativa | — |

### Respostas às perguntas do UX (AQ-1 a AQ-8)
| # | Resposta |
|---|---|
| AQ-1 | **Sim.** HTTP 200, 400, 401, 429 e 500, sempre com `result` ([Contratos](#contratos)). O bloqueio traz `retry_after_minutes`, já arredondado para cima, e o `Retry-After` em segundos. A tela usa `fetch` (serviço `requestSignIn`) e lê o status e o corpo direto. |
| AQ-2 | **20 s.** A função responde em cerca de 0,7 s nas falhas, por causa do piso, e em 1 a 2 s no sucesso. A tentativa que chegou ao servidor conta mesmo que a tela desista (DA-10). |
| AQ-3 | **Uma tabela de casos, duas implementações.** A regra não pode ficar num lugar só, porque a tela não consulta o servidor. O JSON de casos alimenta o Vitest e o pgTAP, e um teste quebra se uma das duas divergir. |
| AQ-4 | `events.action = 'login_blocked'`. Motivo, tipo, identificação mascarada, tipo e duração do bloqueio ficam em `metadata` (`reason`, `identifier_type`, `identifier_masked`, `block_scope`, `block_minutes`), e o `error_reason` repete o motivo em pt-BR. O cadastro vai em `entity_id` e `entity_label` (o nome), nos três eventos. O autor só existe no login realizado. |
| AQ-5 | **Sim.** A máscara sai da forma normalizada, no padrão de hoje. As formas do mesmo celular dão a mesma máscara. |
| AQ-6 | O volume tem limite por origem e por identificação ([Auditoria](#auditoria-rn-15)). A paginação da Auditoria fica fora deste passo. A retenção dos eventos de falha é uma decisão de negócio (risco 5). |
| AQ-7 | **Sim** (tarefa 7). |
| AQ-8 | **Sim.** O E1.04 implementa a T1 (com a T10 ajustada) e cria o `src/lib/auth/session.ts`. O PR 6 do E2.01 fica só com o encerramento da sessão: o `AuthContext`, o `shouldEndSession` no mesmo módulo e o estado `session_ended` na navegação, que a tela do E1.04 já mostra. |

**Pontos do PO:**

| # | Onde |
|---|---|
| 1 | [Avaliação da RN-14](#avaliação-da-rn-14-caminho-único) |
| 2 | [A função `sign-in`](#a-função-sign-in), "Limites do próprio Auth" |
| 3 | [Origem confiável](#origem-confiável-rn-11) |
| 4 | [Tempo igual](#tempo-igual-rn-07-e-p-log-04) |
| 5 | [Contagem e bloqueio](#contagem-e-bloqueio-rn-10-a-rn-12) |
| 6 | [Busca pelo cadastro](#busca-pelo-cadastro-rn-01-a-rn-06) |
| 7 | [Auditoria](#auditoria-rn-15) |
| 8 | [Implantação](#implantação) |
| 9 | [A função `sign-in`](#a-função-sign-in), `verify_jwt` |

### Decisões técnicas
| # | Decisão | Motivo |
|---|---|---|
| DT-01 | **(revisar no PR)** O caminho único desliga o provedor de e-mail e senha do Auth (`external_email_enabled = false`). A `sign-in` emite a sessão com `generateLink(magiclink)` e `/verify`. | O hook de senha é só do plano Team. O hook de token abre um oráculo de senha. Com o provedor desligado, a recusa vem antes da busca, igual para todos. |
| DT-02 | A senha é conferida no banco, numa RPC só (`sign_in_attempt`, `SECURITY DEFINER`, só `service_role`), com `extensions.crypt` contra `auth.users.encrypted_password`. | Busca, contagem, conferência e Auditoria na mesma transação. A credencial legada do E3.02 também nunca sai do banco. |
| DT-03 | Contagem atômica: uma linha por chave em `private.sign_in_throttle`, travada com `INSERT … ON CONFLICT DO UPDATE` em ordem fixa antes da conferência, com janela deslizante (`timestamptz[]`) e bloqueio gravado na linha. | RN-10 e RN-11 sob concorrência, sem *deadlock*. A falha na contagem desfaz tudo (P-LOG-12). |
| DT-04 | As chaves são HMAC-SHA256, com a chave no Vault gerada pela migration. Limpeza pelo `pg_cron` a cada 10 minutos, com `SKIP LOCKED`. | Nem a identificação (CPF, e-mail) nem a origem ficam em claro, e nenhuma linha passa de cerca de 45 minutos (RN-11, LGPD). |
| DT-05 | Chaves de identificação `e:`, `c:`, `m:` e `x:`. Um número que é CPF e celular conta nas duas (DA-7). | "Mesma identificação" da RN-10, inclusive o 9º dígito. |
| DT-06 | Origem: só o `CF-Connecting-IP`; IPv4 mapeado vira IPv4; IPv6 por `/64`; falha fechada fora da stack local (DA-1), com o ambiente decidido pelo host de `SUPABASE_URL` ([Origem confiável](#origem-confiável-rn-11)). | Sonda da tarefa 1: o Cloudflare recusa o cabeçalho forjado; o último valor do XFF é um salto da AWS e o primeiro é redundante. |
| DT-07 | Tempo igual: um bcrypt de custo 10 (o de produção, tarefa 1) em toda tentativa não bloqueada, mais um piso de 700 ms nas respostas 401 e 429. | RN-07 e P-LOG-04, inclusive no E3.02. |
| DT-08 | Normalização no banco (`normalize_mobile`, `mobile_match_key`, `is_valid_cpf` e `is_placeholder_email`, ao lado das `normalize_*` do E2.01), com índices de expressão. A tela replica a regra, e as duas passam pela mesma tabela de casos. | DT-17 do E2.01; AQ-3. O E2.04 usa as mesmas funções nos índices únicos. |
| DT-09 | Busca em dois estágios: os não excluídos decidem; os excluídos só dão o motivo e a ligação. No celular, a correspondência exata vem antes da do 9º dígito. | RN-03 d e e, RN-05 e RN-15. |
| DT-10 | Contrato HTTP com `result` e a sessão mínima; `verify_jwt = false`; chave secreta nova com `Sb-Forwarded-For` no `/verify`. | AQ-1, RN-13 e o limite de `/verify` por pessoa. |
| DT-11 | Auditoria: `login_blocked` numa migration separada; falha e bloqueio gravados pela RPC; login gravado depois da sessão; o cadastro em `entity_id` e `entity_label`; chaves estáveis em `metadata`; a falha de gravação não muda a resposta; `log_auth_event` só com `logout` (PR 3). | RN-15, AQ-4 e P-LOG-12. |
| DT-12 | A máscara sai da forma normalizada (`parse_login_identifier`). | AQ-5. |
| DT-13 | A configuração do Auth de produção é feita pela Management API, no roteiro, e conferida pelo "Deploy: banco". A stack local usa o `config.toml`. Nunca `supabase config push`. | As migrations não configuram o Auth, e o `config.toml` não tem as demais opções de produção. |
| DT-14 | O ponto do E3.02 é `private.sign_in_check_legacy`, antes da conferência da conta, mais o `password_action` no contrato. A credencial legada só é apagada depois de a senha ser gravada no Auth. | RN-17 b a e; um bcrypt por tentativa. |
| DT-15 | A `get-user-email` sai num PR próprio, depois do promote e do passo B. O workflow ganha `EDGE_FUNCTIONS_REMOVED`, que apaga a função a cada execução, e a conferência de `external_email_enabled = false`. | RN-16 e P-LOG-10. O promote não publica funções, e um "Deploy: banco" de outro commit também não a recria. |
| DT-16 | O E1.04 entra depois do PR 1 do E2.01. A migration confere o pré-requisito. A T1 do E1.04 substitui a T10 do E2.01. | Usa `deleted_at`, `private` e as `normalize_*` do E2.01, sem duplicar nada. |
| DT-17 | No front, `signIn` devolve um resultado tipado, os textos ficam em `session.ts`, o serviço usa `fetch` com tempo-limite de 20 s e a Auditoria lê o `metadata` por *type guard*. | Sem `any`, sem `toast` no login, uma fonte de textos (AQ-8). |
| DT-18 | Na emissão da sessão: uma nova tentativa com `otp_expired`; o link pendente é descartado na falha; o usuário criado por engano é apagado. | Dois logins da mesma conta ao mesmo tempo; não deixar um código de uso único válido por 1 hora. |
| DT-19 | Teto de tempo dentro da `sign_in_attempt`: no fim, antes do `RETURN`, se `clock_timestamp() - statement_timestamp() > 5 s`, `RAISE` (SQLSTATE `57014`). Tudo é desfeito e a `sign-in` responde 500, sem contar. Não se usa `SET statement_timeout` na definição: o Postgres arma o temporizador no início do comando, e o `SET` da função não o muda (o backend confirma num teste). | Produção registra o plano **com os parâmetros** (a senha) de comando concluído em 10 s ou mais (`auto_explain`, tarefa 1). Comando que termina em erro não é registrado. Hoje o `statement_timeout` de 8 s do `authenticator` já impede; o teto vale mesmo se alguém subir esse valor (risco 11). |

### Riscos (concorrência, escala, segurança)
1. **Dependência do comportamento do Auth (DT-01).** O caminho único depende de o Auth recusar o login por senha com o provedor desligado, e de o `generateLink` e o `/verify` continuarem como hoje.
   - Mitigações:
     - o "Deploy: banco" confere `external_email_enabled = false` a cada execução (PR 3);
     - o *smoke* de cada deploy testa o login pela `sign-in`;
     - a tarefa 7 testa o login direto recusado e a renovação.
   - Plano B, se o Supabase mudar algo: voltar a ligar o provedor e aceitar a RN-14 parcial até haver outro caminho, com o aceite do usuário.
2. **Leitura e escrita no schema do Auth.**
   - A RPC lê `auth.users` (hash, banimento, confirmação, `deleted_at`).
   - A `sign_in_discard_link` apaga `auth.one_time_tokens` e limpa `recovery_token`.
   - É a mesma classe de risco da DT-13 do E2.01. Conferido em produção (tarefa 1): o `postgres` tem SELECT em `auth.users` (inclusive `encrypted_password`), UPDATE de `recovery_token` e SELECT e DELETE em `auth.one_time_tokens`, que tem RLS ligado, mas o `postgres` tem BYPASSRLS. Os hashes são `$2a$10$`.
3. **CPU do bcrypt no Postgres.**
   - Cada tentativa custa um bcrypt de custo 10: cerca de 45 ms local, mais na instância gratuita.
   - Um ataque distribuído por muitas origens gasta CPU do banco: 50 bcrypts por origem a cada 15 minutos. As tentativas bloqueadas não gastam nada.
   - Mitigação: acompanhar a CPU no painel. CAPTCHA fica fora de escopo e pode ser um passo futuro.
4. **Fila por origem.**
   - As tentativas da mesma origem passam uma de cada vez, por causa da trava, com cerca de um bcrypt de espera por tentativa à frente.
   - Com 50 logins ao mesmo tempo na rede da igreja, o último espera alguns segundos.
   - Acima de 3 s de espera, a tentativa vira erro do servidor (`lock_timeout`) e não conta. A pessoa tenta de novo.
5. **Volume da Auditoria.**
   - Cerca de 84 eventos por hora por origem atacante. Com 1.000 origens por um dia, são cerca de 2 milhões de linhas, perto do limite de 500 MB do plano gratuito.
   - **Para o PO:** definir a retenção dos eventos de falha e de bloqueio, por exemplo 90 dias. Considerar também um teto de registro por hora, que muda a RN-15 b.
   - A paginação da Auditoria fica para um passo futuro (AQ-6).
6. **Cabeçalho de origem.** Se o *gateway* do Supabase mudar os cabeçalhos:
   - a origem pode virar forjável, e a RN-11 fica contornável;
   - ou pode desaparecer, e todos os logins dão erro, por falha fechada.

   O *smoke* pega o segundo caso. O primeiro só um novo teste da sonda pega, então convém refazê-la quando o Supabase anunciar mudança de *gateway* ou de CDN.
   - A regra depende do Cloudflare na frente do `*.supabase.co` (DT-06). Quem alcançasse a origem sem passar por ele forjaria o cabeçalho; o endereço dela não é público.
   - Plano B, depois de nova sonda: o `Sb-Forwarded-For` de entrada, que o *gateway* sobrescreve com o IP real.
7. **`Sb-Forwarded-For` desligado ou chave secreta ausente.** O limite de `/verify` passa a ser o do IP da Edge Function, cerca de 6 logins por minuto para a igreja inteira, o que derrubaria o cutover.
   - A implantação liga o encaminhamento e sobe o limite antes do promote.
   - A função exige a chave secreta em produção. Conferido na tarefa 1: `SUPABASE_SECRET_KEYS` (com a chave `default`) existe nas Edge Functions, e o campo `security_sb_forwarded_for_enabled` existe e hoje está `false` (o passo A liga).
   - O E5 (ensaios) deve incluir uma rajada de logins.
   - A chave secreta nova não pôde ser testada na stack local (a CLI não injeta `SUPABASE_*` pelo `--env-file`): o *smoke* do passo A é a primeira chamada real com `sb_secret_…` na RPC, no `generateLink` e no `/verify` com `Sb-Forwarded-For`. Se falhar, a função responde 500 e nada muda para os usuários (a tela ainda usa a `get-user-email`).
8. **Dois logins da mesma conta ao mesmo tempo.** O segundo `generateLink` troca o *token* do primeiro, e a nova tentativa resolve (DT-18). Se as duas falharem, a tela mostra o erro do servidor, e a pessoa tenta de novo.
9. **Código de uso único pendente.** Se a emissão falhar depois do `generateLink`, o código da conta valeria por 1 hora pelo `/verify` com e-mail e código. Em produção, o código tem 8 dígitos (`mailer_otp_length = 8`) e vale 1 hora (`mailer_otp_exp = 3600`), conferidos na tarefa 1.
   - A `sign_in_discard_link` o apaga.
   - Se até isso falhar, sobra o limite de `/verify` por IP (150 a cada 5 minutos, cerca de 1.800 por hora) contra 10^8 combinações.
10. **Rollback:**
    - Depois do passo B, voltar o app exige religar o provedor de e-mail.
    - Depois do PR 3, o app antigo fica sem login por CPF e celular. Isso foi aceito na RN-16.
11. **Senha como parâmetro SQL.** Produção (PostgreSQL 17.6, tarefa 1):
    - não registram parâmetros: `log_statement = ddl`, `log_min_duration_statement = -1`, `log_parameter_max_length_on_error = 0`, `pgaudit.log = none`; o `pg_stat_statements` (`track = top`) normaliza os valores;
    - **o `auto_explain` está carregado com `log_min_duration = 10s` e `log_parameter_max_length = -1`:** um comando que **termine** em 10 s ou mais tem o plano registrado com os parâmetros, inclusive a senha. Comando cancelado ou com erro não é registrado;
    - hoje isso não acontece: o `authenticator` entra com `statement_timeout = 8s` (`anon` 3 s, `authenticated` 8 s, `service_role` sem valor próprio, global 2 min);
    - defesa em profundidade: a DT-19 (teto de 5 s dentro da `sign_in_attempt`).

    Nunca subir o `statement_timeout` do `authenticator` ou do `service_role` para 10 s ou mais, nem baixar o `auto_explain.log_min_duration`, nem ligar `log_statement = all`, nem fazer `RAISE` com a senha. O `CLAUDE.md` ganha a armadilha (tarefa 10).
12. **Senha trocada no meio do login.** Se a senha muda entre a conferência e a emissão (cerca de 200 ms), a sessão sai com a senha antiga.
    - Fica aceito, por ser raro e sem ganho para um atacante.
    - A suspensão do E2.01 não entra nesse caso, porque o `/verify` recusa conta banida.
13. **Vault e `pg_cron`.** Sem a chave do Vault, todo login dá erro, por falha fechada. Sem o `pg_cron`, a retenção de 24 horas não tem garantia. A tarefa 4 testa os dois.
    - Produção (tarefa 1): `supabase_vault` 0.3.1 instalada, sem segredos; o `postgres` tem EXECUTE em `vault.create_secret` e SELECT em `vault.decrypted_secrets`, mas não INSERT em `vault.secrets`. A migration usa só esses dois.
    - O `pg_cron` 1.6.4 está **disponível e não instalado** (já no `shared_preload_libraries`, `cron.database_name = postgres`): a migration 2 faz o `CREATE EXTENSION`. O `pgcrypto` 1.3 está instalado.
14. **Recuperação de senha.** O E1.07 não pode usar o `/recover` padrão e precisa de uma função própria (leitura técnica 1).
15. **Unicidade só no E2.04.** Até lá, celulares e e-mails repetidos caem na RN-05. O E2.04 deve usar `mobile_match_key` no índice único do celular, como o PO pediu.
16. **Rede compartilhada e CGNAT (RN-11).** Hoje todos chegam por IPv4, e um IPv4 é uma origem.
    - Na rede da igreja, todos saem pelo mesmo IP público. No dia do cutover, 20 senhas erradas de pessoas diferentes em 15 minutos bloqueiam **todos** os logins daquela rede por 15 minutos, inclusive os de senha certa (o bloqueio vem antes da conferência), e não há desbloqueio (RN-12).
    - No 4G, as operadoras dividem um IPv4 entre muitos assinantes (CGNAT). O efeito é o mesmo, mas raro: só contam falhas no login do MCI.
    - Fila na mesma origem (risco 4), medida na stack local: 80 logins simultâneos com senha certa passam; com 120, 5 dão 500 pelo `lock_timeout`. Na instância de produção o bcrypt é mais lento, então o ponto de corte cai; o E5 mede.
    - ~~Para o PO: manter 20, subir o limite da origem, subir só durante o cutover, ou orientar o uso do 4G.~~ **Decidido pelo usuário (2026-11-24): o limite da origem sobe para 50** (RN-11), de forma permanente. O de identificação (5) continua protegendo cada conta. Entra numa migration própria, no PR que segue o PR 1 (PR 1b).
17. **Máscara da identificação inválida.** No PR 1 ela guardava o primeiro e o último caractere (AQ-5), e quem colasse a senha no campo de identificação deixaria dois caracteres dela na Auditoria. **Decidido pelo usuário (2026-11-24): a inválida vira só `***`** (inclusive acima de 254 caracteres). E-mail e número mantêm a máscara. Entra no PR 1b, junto com a tabela de casos que a tela do PR 2 lê.

### Ordem em relação ao E2.01
**Recomendação:**
1. PR 5 do E1.08 (em implementação).
2. **PR 1 do E2.01** (banco, neutro), em produção.
3. **PR 1 do E1.04** (banco e função, neutro). Pode correr em paralelo com o PR 2 do E2.01.
4. **PR 2 do E1.04** (tela). Antes do PR 6 do E2.01.
5. PR 6 do E2.01, reduzido ao encerramento da sessão.
6. **PR 3 do E1.04**, a qualquer momento depois do passo B.

**Por quê:**
- O E1.04 usa `members.deleted_at` (RN-05, RN-06, RN-07 d), o schema `private`, as `normalize_email` e `normalize_digits` (DT-17 do E2.01) e o `log_auth_event` com o filtro de excluídos (DA-9 do E2.01).
- Vir depois evita duplicar tudo isso e evita uma segunda versão da tela de login.
- A migration 2 confere o pré-requisito e falha cedo se a ordem for invertida.

**O que muda no E2.01** (registrar naquele spec na tarefa 10):
- **DT-14:** o filtro de excluídos na `get-user-email` continua no PR 1 de lá, porque a função vive até o PR 3 do E1.04. Depois disso, vale a `sign-in`.
- **PR 6 (T21):**
  - sai a tela de login, que agora é a T1 do E1.04;
  - ficam o `AuthContext` (releitura do próprio cadastro, `SIGNED_OUT` não pedido, volta do foco), o `QueryCache`/`MutationCache` e o `shouldEndSession` em `src/lib/auth/session.ts`;
  - a navegação para `/login` passa `state: { reason: 'session_ended' }`.
- **RN-14 de lá (testes T23):** o login de um excluído é testado pela `sign-in` (motivo "Cadastro excluído"). O login direto no Auth passa a responder `email_provider_disabled` para todos.

### Dependências e impactos em outros passos
| Passo | Relação |
|---|---|
| E1.08 PR 5 | Nenhuma interferência: as funções do E1.04 são *definer* e não leem colunas novas, e o E1.04 não cria colunas em `members` |
| E2.01 | Pré-requisito (PR 1). Ver [Ordem](#ordem-em-relação-ao-e201). |
| E2.02 | Também mexe no `AuthContext` (releitura do acesso). Quem vier depois rebaseia, sem conflito de regra. |
| E2.03 | A troca obrigatória lê `app_metadata.must_change_password` da sessão vinda da `sign-in`. A redefinição assistida não termina o bloqueio (RN-12). |
| E2.04 | Índices únicos parciais sobre `normalize_email(email)`, `normalize_digits(cpf)` e `mobile_match_key(mobile_whatsapp)`, que podem substituir os três índices de busca deste passo. Com eles, a RN-05 só acontece em dados antigos. |
| E1.06 | Acrescentar o domínio da D7 em `is_placeholder_email`, sem tirar o antigo enquanto houver contas com ele |
| E1.07 | Recuperação por e-mail numa Edge Function própria, com `generateLink({ type: 'recovery' })` e SMTP, porque o `/recover` padrão fica desligado. Ela deve reaproveitar a busca e o limite deste passo. Um login pela `sign-in` invalida um link de recuperação pendente da mesma conta. |
| E3.01 | `private.legacy_credentials` com `bcrypt(md5)` de **custo 10**, igual ao do Auth (DT-07) |
| E3.02 | Implementa `sign_in_check_legacy` e o `password_action`. A `sign-in` grava a senha (`updateUserById`) antes de emitir a sessão e só depois apaga a credencial. O motivo da falha é "Senha incorreta", com `metadata.credential = 'legacy'`. |
| E4.08 | A conta é criada com `email_confirm: true` e senha aleatória do Auth (custo 10). A recomendação do PO de alinhar a 6.2 com a D5 vale aqui. |
| E5 (ensaios) | Incluir uma rajada de logins da mesma rede (risco 7) e medir a CPU do banco (risco 3) |

### Pontos de extensão
| Futuro | Onde muda |
|---|---|
| Senha legada (E3.02) | `private.sign_in_check_legacy` e `password_action`. A busca, a contagem, o tempo e a Auditoria não mudam (RN-17 c). |
| Domínio fictício novo (E1.06) | `public.is_placeholder_email` |
| Consolidação | O primeiro e o segundo estágio da busca passam a ignorar o consolidado, que vira `not_found` |
| Desbloqueio manual ou redefinição que termina o bloqueio | Uma RPC que apague as linhas de identificação de um cadastro, calculando as chaves a partir dos dados dele. Fora deste passo (RN-12). |
| Outros limites (CAPTCHA, bloqueio progressivo) | Constantes no começo da `sign_in_attempt`, e a `sign-in` antes da RPC |

### Implantação
| Passo | Quem | O que | Efeito |
|---|---|---|---|
| PR 1 | usuário | merge → "Deploy: banco" (migrations 1 e 2; funções `create-user-admin`, `get-user-email` e `sign-in`) | Nenhum: a tela ainda usa a `get-user-email` |
| PR 1b | usuário | merge → "Deploy: banco" (migration que sobe o limite da origem para 50 e troca a máscara da identificação inválida por `***`, riscos 16 e 17) | Nenhum: a tela ainda usa a `get-user-email` |
| A | usuário | Management API: `security_sb_forwarded_for_enabled = true` e `rate_limit_verify = 150`. *Smoke* com uma conta de teste, por `curl` na `sign-in`: e-mail, CPF e celular dão 200; senha errada dá 401; a Auditoria mostra os registros. | Nenhum para os usuários |
| PR 2 | usuário | merge → promote | A tela nova entra no ar. *Smoke* pela tela, com e-mail, CPF e celular. |
| B | usuário | Management API: `external_email_enabled = false`. *Smoke*: o login direto no Auth recusa (`email_provider_disabled`), e uma sessão aberta continua renovando. | Caminho único (RN-14) |
| PR 3 | usuário | merge → "Deploy: banco" (migration `e104_04`, a 3 da ordem; remove a `get-user-email`; confere o Auth). *Smoke*: a `get-user-email` responde 404. | RN-16. O E1.04 pode ser aceito. |

- O promote já recusa rodar com migration pendente. O PR 2 não tem migration.
- **Rollback:**
  - **antes do passo B:** promote do commit anterior;
  - **depois do passo B:** promote do commit anterior e `external_email_enabled = true`;
  - **depois do PR 3:** o mesmo, mas o app antigo fica sem login por CPF e celular, porque a `get-user-email` não volta (RN-16).

  As migrations ficam: são neutras para o app antigo, exceto a 3, que só recusa o login registrado pelo cliente, e o app antigo ignora o erro.

### Verificações obrigatórias (para o QA)
**pgTAP** (`supabase/tests/database/e104_*.test.sql`, autocontido, com `ROLLBACK`):
- **Massa:** Ana, Bruno (e-mail fictício), Carla (conta com e-mail antigo), Hugo, Gabi, Ivo e Joana, Davi e Elisa, Otávio e Paula, Rita (excluída, conta suspensa) e Sílvia, Ulisses, Léo, Quintino (sem conta), Nina (inativa), Samuel (pastor), Lia (sem permissões), uma conta não confirmada, uma banida e uma conta sem cadastro. Contas criadas com hash bcrypt de custo 10.
- **Grants e estrutura:**
  - `sign_in_*` só com EXECUTE para `service_role`;
  - funções de `private` sem EXECUTE para ninguém além do dono;
  - `private.sign_in_throttle` sem privilégios para `anon`, `authenticated` e `service_role`;
  - o job `e104-sign-in-purge` agendado;
  - a chave no Vault;
  - os três índices usados pela busca, com o `EXPLAIN` anexado.
- **Tabela de casos (AQ-3):** `parse_login_identifier` em cada linha do JSON. Formato, formas normalizadas e máscara.
- **RN-01 a RN-06:** cada critério pela `sign_in_attempt` (resultado e motivo). Carla com o e-mail novo entra e com o antigo não; o e-mail fictício dá `not_found`; Ivo e Joana entram; Davi e Elisa dão `ambiguous`; Rita dá `member_deleted` e Sílvia entra; Ulisses entra; a conta sem cadastro dá `not_found`.
- **RN-07:** o mesmo `{ "result": "invalid" }` em todos os casos (a) a (g), sem dado do cadastro.
- **RN-10 a RN-12, mexendo nos horários das linhas** (sem esperar o relógio):
  - 4 falhas e a 5ª com outra forma do mesmo celular dá `locked` com 15 minutos;
  - a senha certa durante o bloqueio dá `locked` com o tempo restante, sem estender;
  - o e-mail de Ana continua livre;
  - o bloqueio vencido zera a contagem;
  - o sucesso zera a identificação e não a origem;
  - origem com 50 falhas;
  - origem e identificação bloqueadas: vale o maior prazo;
  - 30 segundos restantes dão 1 minuto;
  - o número CPF e celular conta nas duas chaves (DA-7);
  - IPv6 do mesmo `/64`.
- **RN-11, retenção:** linhas antigas apagadas pela `sign_in_purge`. Nenhuma linha contém a identificação nem a origem em claro (procurar o CPF, o e-mail e o IP em `key_hash::text`).
- **RN-15:**
  - um evento por falha, com `reason`, `identifier_type` e `identifier_masked` certos, inclusive os quatro tipos do critério;
  - um evento por bloqueio e nenhum pelas tentativas recusadas;
  - `sign_in_record_login` grava o autor e o cadastro;
  - nada de senha, identificação completa ou origem em `events`;
  - Lia não lê os eventos;
  - com um `CHECK` em `events` criado dentro do teste, a `sign_in_attempt` responde igual (P-LOG-12).
- **P-LOG-12:** sem a chave do Vault, ou com a linha travada além do `lock_timeout`, a RPC dá erro, e nada foi contado.
- **DT-19:** `SELECT pg_sleep(5.2), public.sign_in_attempt(...)` no mesmo comando dá 57014, e nada foi contado nem registrado.
- **`log_auth_event` (migration 3):** `login` recusado com 22023, e `logout` gravado.

**Concorrência** (script com várias conexões, como no E2.01):
- 20 chamadas simultâneas com o CPF de Ana: exatamente 5 falhas na Auditoria, e as outras com `locked`;
- 30 chamadas simultâneas de uma origem com identificações diferentes: no máximo 20 conferidas;
- a limpeza rodando durante as tentativas, sem *deadlock*.

**Edge Function** (stack local, `supabase functions serve` ou o *edge runtime* do `supabase start`):
- **contrato:** os seis status e os corpos;
- **sessão:** a sessão mínima, sem `user` nem e-mail;
- **origem (DT-06):** com `CF-Connecting-IP`, `X-Forwarded-For`, `True-Client-IP`, `Forwarded` e `X-Real-IP` diferentes, conta só o `CF-Connecting-IP` (duas origens diferentes contam em linhas diferentes); sem ele, local usa `127.0.0.1`;
- **erros:** a RPC com erro dá 500;
- **logs:** sem dado pessoal (inspecionar a saída);
- **emissão da sessão:** a nova tentativa com `otp_expired` e o descarte do link.

**Tempo (RN-07):**
- 20 tentativas de cada caso, (a) a (g), contra a função local;
- a mediana de cada caso fica a menos de 100 ms da de "senha errada";
- o p99 de cada caso fica abaixo do piso;
- o relatório vai anexado ao PR.

**Caminho único (RN-14, stack local com o `config.toml` do PR 2):**
- `POST /auth/v1/token?grant_type=password` com a senha certa responde 422 `email_provider_disabled`;
- a sessão emitida pela `sign-in` renova com `grant_type=refresh_token`;
- o `logout` funciona.

**Vitest:**
- `classifyIdentifier` sobre a tabela de casos (UX-10);
- `session.ts`: textos (UX-09) e o singular;
- `parseSignInResponse` com respostas fora do contrato;
- `auth-events.ts`;
- `client-ip.ts` e `http.ts` da função.

**Playwright:** os critérios de UX (tarefa 7), mais:
- o *smoke* de login real na stack local com e-mail, CPF e celular;
- o `e2e/dashboard.spec.ts` sem `log_auth_event` em `AUTH_PATHS`.

## Tarefas
_Seção do `architect`._

Três PRs no `mci-connect`. **Tudo começa depois do PR 1 do E2.01 em produção.**
- Dentro de cada PR, o banco vai primeiro, e os tipos são regenerados antes do front.
- Cada desenvolvedor aciona o `code-reviewer` ao terminar a sua tarefa; esse passo não aparece na tabela.
- Os passos A e B da [Implantação](#implantação) são do usuário. Eles aparecem na tabela para não serem esquecidos.
- Na coluna RNs, os números são das regras deste spec. Na coluna UX, os dos critérios `UX-`.

| # | Responsável | Descrição | Arquivos | RNs | UX | Depende de |
|---|---|---|---|---|---|---|
| **PR 1: banco e função `sign-in` (neutro para o usuário)** | | | | | | |
| 1 | backend-developer | Conferências em produção, **só de leitura e com autorização do usuário**:<br>(a) prefixo e custo dos hashes em `auth.users` (contagem por `left(encrypted_password, 7)`);<br>(b) privilégios do `postgres`: SELECT em `auth.users`, UPDATE de `recovery_token` e DELETE em `auth.one_time_tokens`;<br>(c) Vault utilizável pelo `postgres` e `pg_cron` disponível;<br>(d) `SHOW log_statement`, `log_min_duration_statement`, `log_parameter_max_length_on_error` e `shared_preload_libraries`;<br>(e) GET da configuração do Auth: provedores, `disable_signup`, `rate_limit_*` e o campo `security_sb_forwarded_for_enabled`;<br>(f) sonda temporária de cabeçalhos de IP, uma função publicada só para o teste e apagada em seguida. Ela é chamada de duas redes (Wi-Fi e 4G com IPv6), com `X-Forwarded-For`, `X-Real-IP` e `CF-Connecting-IP` forjados, e devolve só os cabeçalhos de IP e se `SUPABASE_SECRET_KEYS` existe.<br><br>Registrar o resultado na DT-06 e no risco 11. Parar e voltar ao `architect` se (a) não for bcrypt, se faltar privilégio em (b) ou se (f) não tiver cabeçalho confiável.<br><br>**Feita em 2026-11-24** (sessão principal, com autorização): nada bloqueia. Resultados na DT-06, DT-07, DT-19 e nos riscos 2, 6, 7, 9, 11, 13 e 16. A chamada pelo 4G fica só como registro do CGNAT. | — | 06, 07, 09, 11, 14 | — | PR 1 do E2.01 em produção |
| 2 | backend-developer | Migrations 1 e 2:<br>- `login_blocked`;<br>- guarda de pré-requisito;<br>- `normalize_mobile`, `mobile_match_key`, `is_valid_cpf` e `is_placeholder_email`;<br>- os três índices;<br>- `private.sign_in_throttle`, a chave no Vault, `pg_cron` e o job;<br>- `parse_login_identifier`, `sign_in_key`, `sign_in_origin_key`, `sign_in_lookup`, `sign_in_check_legacy` e `sign_in_purge`;<br>- `sign_in_attempt`, `sign_in_record_login` e `sign_in_discard_link`;<br>- grants;<br>- ordem das travas e o algoritmo no cabeçalho.<br><br>Regenerar o `types.ts`. | `supabase/migrations/<ts>_e104_01_enum.sql`, `supabase/migrations/<ts>_e104_02_sign_in.sql`, `src/integrations/supabase/types.ts` | 01 a 12, 15, 17 | — | 1 |
| 3 | backend-developer | Edge Function `sign-in`: o *handler*, `lib/client-ip.ts` (regra da tarefa 1), `lib/http.ts` (respostas e piso), a emissão da sessão (DT-18) e os logs sem dado pessoal.<br><br>No `config.toml`: `[functions.sign-in] verify_jwt = false` e `[auth.rate_limit] token_verifications = 1000` (local), com o comentário da DT-13. No `deploy-banco.yml`: `sign-in` em `EDGE_FUNCTIONS`. No `vitest.config.ts`: incluir `supabase/functions/**/lib/*.test.ts`. | `supabase/functions/sign-in/{index.ts,lib/client-ip.ts,lib/http.ts}`, `supabase/config.toml`, `.github/workflows/deploy-banco.yml`, `vitest.config.ts` | 07 a 13, 15 | dados de UX-05, 06, 07 | 2 |
| 4 | qa | pgTAP de todas as RNs no banco; tabela de casos `login-identifier-cases.json` com o SQL gerado e a conferência de sincronia; concorrência; testes da função; medição de tempo; Vitest dos módulos da função ([Verificações](#verificações-obrigatórias-para-o-qa)). | `supabase/tests/database/e104_*.test.sql`, `supabase/tests/fixtures/login-identifier-cases.json`, `supabase/functions/sign-in/lib/*.test.ts`, scripts de concorrência e de tempo | 01 a 13, 15, 17 | — | 3 (escreve em paralelo com a 2 e a 3, a partir dos contratos) |
| A | usuário | Passo A da implantação: `Sb-Forwarded-For` e `rate_limit_verify`, mais o *smoke* por `curl` | — | 11, 14 | — | PR 1 no ar |
| **PR 2: tela de login e Auditoria** | | | | | | |
| 5 | frontend-developer | - `src/lib/auth/{identifier,session,sign-in-result}.ts` e `src/lib/audit/auth-events.ts`, com Vitest (o `identifier` lê a tabela de casos);<br>- `src/services/auth/sign-in.ts`;<br>- `AuthContext.signIn` com `setSession`, sem `get-user-email`, sem `signInWithPassword` e sem o registro de login pelo cliente;<br>- `Login.tsx` com a T1 inteira;<br>- `Events.tsx` com a T2 (rótulo, segunda linha, painel, `outline`, sem `any`);<br>- `config.toml` com `[auth.email] enable_signup = false` (local, para a RN-14). | `src/lib/auth/*`, `src/lib/audit/auth-events.ts`, `src/services/auth/sign-in.ts`, `src/contexts/AuthContext.tsx`, `src/pages/Login.tsx`, `src/pages/Events.tsx`, `supabase/config.toml` | 01 a 04, 07, 08, 09, 12 a 15 | 01 a 19 | PR 1 mergeado (tipos) |
| 6 | ux-designer | Revisão de UI da T1 e da T2 em 320, 360 e 1280 px, nos temas claro e escuro, com teclado virtual e leitor de tela | — | — | 01 a 19 | 5 |
| 7 | qa | - Testes de componente: UX-01, 02, 04, 06 (relógio simulado), 07, 08, 11, 12, 13, 15, 16 e 17;<br>- Playwright com a rede interceptada: UX-01, 03, 05, 14 e 19;<br>- login real na stack local: RN-01 a RN-04, RN-08 e RN-13;<br>- `e2e/login.spec.ts` com `getByLabel("Senha", { exact: true })` (AQ-7);<br>- `e2e/dashboard.spec.ts` sem `log_auth_event`;<br>- RN-14 na stack local;<br>- UX-18 com o axe. | `src/**/*.test.tsx`, `e2e/login.spec.ts`, `e2e/sign-in.spec.ts`, `e2e/dashboard.spec.ts` | 01 a 04, 07, 08, 12 a 15 | 01 a 19 | 5 |
| B | usuário | Passo B da implantação: `external_email_enabled = false`, mais o *smoke* da RN-13 e da RN-14 | — | 13, 14 | — | PR 2 promovido e *smoke* da tela |
| **PR 3: saída da `get-user-email`** | | | | | | |
| 8 | backend-developer | - Migration 3 (`log_auth_event` só com `logout`, mantendo a DA-9 do E2.01);<br>- apagar `supabase/functions/get-user-email/` e a seção dela no `config.toml`;<br>- no `deploy-banco.yml`: tirar a função de `EDGE_FUNCTIONS`, criar `EDGE_FUNCTIONS_REMOVED: get-user-email` com um passo de remoção idempotente (função inexistente não é erro; conferir a flag de confirmação da CLI 2.58.5) e um passo que falha se o `GET /v1/projects/{ref}/config/auth` tiver `external_email_enabled` diferente de `false`. | `supabase/migrations/<ts>_e104_04_log_auth_event_logout_only.sql`, `supabase/functions/get-user-email/` (removida), `supabase/config.toml`, `.github/workflows/deploy-banco.yml`, `src/integrations/supabase/types.ts` | 14, 15, 16 | — | B |
| 9 | qa | pgTAP da migration 3. Depois do "Deploy: banco" e com autorização do usuário, *smoke* em produção:<br>- a `get-user-email` responde 404;<br>- o login direto responde `email_provider_disabled`;<br>- login pela tela com e-mail, CPF e celular;<br>- a renovação funciona. | `supabase/tests/database/e104_log_auth_event.test.sql` | 13, 14, 15, 16 | — | 8 |
| **Fechamento** | | | | | | |
| 10 | architect | Revisão final dos 3 PRs:<br>- atualizar o `CLAUDE.md` (estado atual, armadilhas, deploy e problemas conhecidos);<br>- marcar o E1.04 no Progresso de `docs/migracao.md`;<br>- registrar no E2.01 a DT-14 e o PR 6 reduzido.<br><br>O aceite e a matriz de paridade são do `product-owner`. | `CLAUDE.md`, `docs/migracao.md`, `docs/specs/e2-01-exclusao-logica.md` | — | — | 4, 6, 7, 9 |

**Ordem de execução:**
- **PR 1:** 1 → 2 → 3. A 4 é escrita em paralelo com a 2 e a 3 e roda depois da 3. Depois do merge, passo A.
- **PR 2:** 5 → (6 ∥ 7). Depois do promote, passo B.
- **PR 3:** 8 → 9.
- **Fechamento:** 10 no fim.
- **Com o E2.01:**
  - o PR 1 do E1.04 pode correr junto com o PR 2 do E2.01;
  - o PR 2 do E1.04 vem antes do PR 6 do E2.01.

**Critérios de pronto**
1. **Todas as tarefas de banco:**
   - as migrations rodam num banco zerado depois das existentes e das do E2.01, e rodam de novo sem erro;
   - nenhuma função nova tem EXECUTE para `anon`;
   - as `sign_in_*` só têm EXECUTE para `service_role`;
   - o `types.ts` está regenerado;
   - os testes do E1.08 e do E2.01 continuam passando.
2. **Tarefa 2:**
   - a migration falha cedo, sem mudar nada, num banco sem o PR 1 do E2.01;
   - o `EXPLAIN` da busca mostra os três índices;
   - nenhuma linha de `private.sign_in_throttle` contém um valor em claro.
3. **Tarefa 3:**
   - nenhum log da função contém a identificação, a senha, o e-mail, o *token* ou a origem;
   - em produção, a função recusa rodar sem a chave secreta nova;
   - `client-ip.ts` e `http.ts` têm testes.
4. **Tarefa 4:**
   - todos os critérios "pela API" das RN-01 a RN-15 passam na stack local;
   - os cenários de concorrência terminam com no máximo 5 (ou 20) senhas conferidas;
   - a medição de tempo cumpre a RN-07.
5. **Tarefa 5:**
   - `npm run lint`, `npm test` e `npm run build` verdes;
   - sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos ou tocados (`as const` é permitido);
   - nenhum texto do spec fora de `src/lib/auth/session.ts` e `src/lib/audit/auth-events.ts`;
   - nenhuma regra de identificação dentro do componente;
   - o login não usa `toast`;
   - nenhuma chamada a `signInWithPassword`, a `get-user-email` ou a `log_auth_event('login')` no front.
6. **Tarefas 6 e 9:**
   - o `ux-designer` dá o veredito, e os ajustes voltam ao `frontend-developer` antes de o QA fechar o PR;
   - o *smoke* de produção da tarefa 9 é feito só com contas de teste.
7. **Tarefa 8:**
   - um "Deploy: banco" de qualquer commit não publica mais a `get-user-email`;
   - o workflow falha se o provedor de e-mail estiver ligado.

## Testes
_Seção do `qa`._

Arquivos em `mci-connect/supabase/tests/` (PR 1, tarefa 4):
- pgTAP (`database/`): `e104_01_structure_grants` (grants, Vault, job, índices com EXPLAIN, normalização, origem, limpeza, `sign_in_discard_link`), `e104_02_parse_identifier` (gerado do JSON), `e104_03_sign_in_attempt` (busca e decisão), `e104_04_throttle_audit` (limites, retenção, Auditoria, P-LOG-12, DT-19);
- `fixtures/login-identifier-cases.json` + `fixtures/generate-login-identifier-cases.mjs`; sincronia em `src/test/login-identifier-cases-sync.test.ts` (o PR 2 acrescenta o Vitest do `classifyIdentifier` sobre o mesmo JSON);
- `concurrency/e104_concurrency.sh` (20 por CPF, 30 por origem, limpeza durante as tentativas, trava além do `lock_timeout`);
- `edge/sign-in.edge.test.mjs` (contrato, sessão, origem DT-06, 500, piso, logs) e `edge/timing.mjs` (RN-07, 20 tentativas por caso) e `edge/concurrent-success.mjs` (N logins certos da mesma origem).

| RN | Testes (arquivo) | Resultado |
|---|---|---|
| RN-01 a RN-04 | `e104_02` (formatos), `e104_03` (RN-01 a RN-04), `e104_01` (normalização e índices), edge (CPF, e-mail, celular) | PR 1: passou |
| RN-05, RN-06 | `e104_03` (Davi e Elisa, Otávio e Paula, Rita, Sílvia, Ulisses, Nina, Samuel, Lia, Quintino, Rosa restaurada, contas indisponíveis) | PR 1: passou |
| RN-07 | `e104_03` (casos a a g, mesmo `{"result":"invalid"}`), edge (mesmo corpo e piso), `edge/timing.mjs` | PR 1: passou |
| RN-08, RN-09, RN-13, RN-17 | `e104_03`, edge (400, sessão mínima, logs sem dado) | PR 1: passou |
| RN-10, RN-11, RN-12 | `e104_04`, `e104_01` (limpeza), `e104_concurrency.sh`, edge (origem, 429) | PR 1: passou |
| RN-15 | `e104_04` (eventos, máscaras, tipos, bloqueios, Lia, CHECK em `events`), edge (login gravado) | PR 1: passou |
| DT-06, DT-19, P-LOG-12 | edge (origem), `e104_04` (57014, Vault, CHECK), `e104_concurrency.sh` (55P03) | PR 1: passou |
| RN-14, RN-16 | PR 2 e PR 3 | — |

Resultados por PR (stack local isolada, CLI 2.84.2):
- **PR 1**: `supabase test db` PASS, 15 arquivos, 1858 testes (E1.08 e E2.01 inclusos; `e104_01` 113, `e104_02`, `e104_03` 105, `e104_04` 129); `npm test` 75 arquivos, 815 testes; `vitest login-identifier-cases-sync` 3; `e104_concurrency.sh` todos os 4 cenários; `node --test supabase/tests/edge/sign-in.edge.test.mjs` 20/20 (função servida com `supabase functions serve sign-in`).
- Concorrência: 20 com o CPF de Ana = 5 conferidas, 4 `invalid`, 16 `locked`, 1 bloqueio, 0 erros; 30 de uma origem = 20 conferidas (19 `invalid` + a que bloqueia), 11 `locked`, 0 erros; limpeza durante as tentativas sem deadlock; trava além do `lock_timeout` dá 55P03 em 3 s e nada é contado.
- **PR 1b** (mci-connect#25, migration `20261125003300_e104_03_origin_limit_invalid_mask.sql`): limite da origem 50 e máscara `***` na inválida (riscos 16 e 17). `supabase test db` PASS, 15 arquivos, 1866 testes (`e104_04` com 135: 50ª falha da origem bloqueia; `metadata` só com `***` para a senha colada e para mais de 254 caracteres, com e sem "@"; varredura RN-15 d ampliada); `e104_concurrency.sh` cenário 2 com 60 simultâneas de uma origem = 50 conferidas, 11 `locked`, 1 bloqueio, 0 erros; edge 21/21; `npm test` 815/815. Tabela de casos: as inválidas esperam `***`, com o caso novo `invalida-senha-colada`.
- Tempo (RN-07, `node supabase/tests/edge/timing.mjs --n 20`), em ms, mediana / p99 (diferença para "g"):

| Caso | Banco | HTTP |
|---|---|---|
| a inválida | 42 / 48 (-0) | 710 / 714 (+0) |
| b não encontrada | 41 / 46 (-0) | 710 / 714 (+0) |
| c ambígua | 43 / 46 (+1) | 709 / 754 (-0) |
| d excluída | 41 / 46 (-0) | 710 / 717 (+1) |
| e sem conta | 41 / 46 (-0) | 709 / 715 (-0) |
| f indisponível | 41 / 46 (-0) | 711 / 714 (+1) |
| g senha errada (ref.) | 42 / 48 | 709 / 714 |
| h bloqueada (429) | 0 / 2 | 709 / 712 (-0) |

  Menor HTTP: 705 ms (piso 700). Critérios cumpridos (diferença < 100 ms; p99 do banco < piso).
- Risco 4/16, logins com senha certa simultâneos da mesma origem (`concurrent-success.mjs`): N=10 -> 10x200, último em 480 ms; N=30 -> 30x200, 1385 ms; N=50 -> 50x200, 2267 ms; N=80 -> 80x200, 3618 ms; N=120 -> 115x200 e 5x500, 5223 ms. O `lock_timeout` de 3 s só vira 500 acima de ~100 simultâneos da mesma origem, na máquina local.
- Bugs da implementação: nenhum. Os erros da primeira rodada eram dos testes (INSERT sem `id` em `auth.one_time_tokens`, `next_origin()` depois do `SET ROLE`, precedência de `->`/`-`, `57014` não é pego por `WHEN OTHERS`, `ip: undefined` caindo no valor padrão, INSERT duplicado do bloqueio).

**PR 2 (tarefa 7, branch `feat/E1.04-pr2-tela-login`, commit `b8a466c`)**

| RN / UX | Arquivo | Resultado |
|---|---|---|
| UX-01, 02, 04, 05, 06 (relógio simulado), 07 (fetch rejeitado, 500, fora do contrato, tempo-limite), 08, 09, 11, 12, 13, 19 | `src/pages/Login.test.tsx` (45) | passou |
| UX-15, 16, 17, RN-15 (máscara `***`, origem ausente) | `src/pages/Events.auth.test.tsx` (14) | passou |
| UX-01, 02, 03 (360x800), 05, 07, 10, 12, 14 (360x800 e 320x568, fonte 200 %), 19 | `e2e/sign-in.spec.ts` (rede interceptada) | passou (45) |
| UX-18 (axe, claro e escuro: mensagem, indicador, "OK" da Auditoria) | `e2e/sign-in.spec.ts`, `e2e/sign-in-stack.spec.ts` | passou; tela inteira no escuro: achado (botão Entrar 2,97:1), marcado `test.fail` |
| RN-01 a RN-04, RN-07, RN-08, RN-12, RN-13, RN-14, RN-15 (login real, stack local) | `e2e/sign-in-stack.spec.ts` | passou (17) |
| AQ-7 e helpers (`login.spec`, `dashboard.spec`, `exclusao-support`, `ministries-selectors`, `create-user-admin`, `cadastro-excluido`, `excluidos-membros`) | `e2e/*` | ajustados; passam |

- `npm test`: 82 arquivos, 1005 testes. `npm run lint`: 12 erros e 8 avisos (a linha de base; arquivos do PR limpos). `npm run build` ok.
- `npx playwright test --workers=1` (stack local isolada, `sign-in` servida, `[auth.email] enable_signup = false`): 151 testes, todos passam (E1.08 e E2.01 inclusos). Em paralelo (`--workers=3`) as specs do E2.01 interferem entre si (massa e `sign_in_throttle` compartilhados): rode com 1 worker.
- `supabase test db` (banco zerado com `db reset`): 15 arquivos, 1866 testes, PASS (`e201_03` passa; não faz login direto).
- Devdependency nova: `@axe-core/playwright@4.10.2`. As specs do E2.01 precisam da role Administrador com todas as permissões (as migrations só dão `view_audit_log`) e de massa para paginar (Células e Relatórios).
- Revisão de UI (tarefa 6, `ux-designer`): **APROVADO**, sem bloqueante. Sugestões que ficam para depois: o anel de foco do bloqueio usa só `focus-visible:` (`Login.tsx`), a linha da Auditoria não abre o painel pelo teclado (já existia) e o contraste do `--primary` no tema escuro (token global, o mesmo achado do axe acima). Os três vão num PR próprio, fora do E1.04.

**PR 3 (tarefa 9, parte local, mci-connect#27, commit `c512973`)**
- Arquivo novo: `supabase/tests/database/e104_log_auth_event.test.sql` (21 testes): RN-15 (e) e RN-16 (lado do banco): `login` com sessão dá 22023 e não grava; outras ações e NULL dão 22023; `logout` grava `auth`/`logout` (autor = a conta, `success`, "Logout realizado") e a 2ª chamada em 30 s não duplica; sem sessão dá 42501 (antes do 22023); excluído não grava e não dá erro (DA-9); `anon` sem EXECUTE, `authenticated` com; `SECURITY DEFINER`, `search_path` fixo, assinatura de 4 argumentos.
- Stack local isolada (CLI 2.84.2, `db reset` do zero): `supabase test db` PASS, 16 arquivos, 1887 testes. `npm test`: 82 arquivos, 1005 testes.
- `npx playwright test --workers=1` (`sign-in` servida, `enable_signup = false`): 151 testes, 145 passam, 5 pulados (os do estado anterior) e 1 falha de massa: `excluidos-membros.spec.ts:605` (UX-19) pede 2 páginas em Células e Relatórios e o banco zerado não tem massa; não é do PR. Nada no e2e usa a `get-user-email`.
- `grep -rn get-user-email src e2e supabase .github`: só o `EDGE_FUNCTIONS_REMOVED` do workflow. O front só chama `log_auth_event('logout')` (`AuthContext.signOut`).
- Preparação local do e2e: o `sign-in-stack` usa a role de id fixo `8f40ab80-…` (não existe num banco zerado) e o admin de teste precisa de `members.email` para o `sign-in` achá-lo.
- Bugs da implementação: nenhum. *Smoke* de produção: pendente (sessão principal, depois do deploy).
