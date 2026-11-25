# E2.03: Redefinição de senha assistida e troca obrigatória de senha

> Status: Negócio, Experiência (UX), Solução técnica e Tarefas prontos (2026-11-23).
> - **PR 1** (mci-connect#41 e #42): **em produção** desde 2026-11-25 ("Deploy: banco" do `6c4f67b`). Conferências 1 a 8 sem parada; passo A (item 9) com contas temporárias, todos os itens ok: `PUT /auth/v1/user` recusado (500, pela guarda), `grant_type=password` 422, redefinição com `must_change_password: true`, troca obrigatória 200, sessão do outro aparelho sem renovação (400), `auth.users` sem senha.
> - Mudanças sobre o desenho, conferidas na stack local: a guarda descarta a senha na criação da conta em vez de recusar (DT-02); o limite por origem é 50 (E1.04 PR 1b; DA-8); o cofre aceita só `$2a$`; a `members_view` foi recriada sobre a definição do E2.06; `set_initial_password` recusa conta que já tem senha (`password_already_set`, tratado como reenvio pela `create-user-admin`).
> - PRs 2 a 4 por fazer. Pela regra nova do fluxo, os PRs 2 e 3 (só front, seguidos) podem ir num PR só.
> Slug: `e2-03-senha` · Paridade com o legado: sim (AUT-06), com regras novas: senha temporária gerada pelo sistema, troca obrigatória, política de senha, senha atual na troca, limites e registro na Auditoria.

## Negócio
_Seção do `product-owner`. Escrita em 2026-11-23 a partir destas fontes:_
- _o passo E2.03, a regra AUT-06 e as seções 6.2, 6.3, 6.4, 6.5 e 6.7 do [`docs/migracao.md`](../migracao.md);_
- _as decisões D5, D6, D7 e D11, e o passo E1.07 (SMTP, ainda sem credenciais);_
- _os specs fechados [`e1-04-sign-in.md`](e1-04-sign-in.md) (RN-07, RN-09 a RN-12, RN-14, RN-15, RN-17, DT-01, DT-14 e as observações sobre a senha `123456`), [`e2-02-perfis-escopo.md`](e2-02-perfis-escopo.md) (escopo, RN-09, RN-17, RN-18, P-PER-08 e a fronteira com este passo) e [`e2-01-exclusao-logica.md`](e2-01-exclusao-logica.md) (RN-07, RN-14, RN-16, DT-12, DT-13 e P-DEL-21);_
- _o código do legado (mapeamento da senha, formulário de membro e tela de login);_
- _o estado do `mci-connect` na `origin/main` (`47c6324`): `supabase/functions/change-member-password/index.ts`, `src/components/MemberForm.tsx` e `src/contexts/AuthContext.tsx`._

_Atualizada no mesmo dia com as decisões do PO sobre as pendências PO-UX-1 a PO-UX-8 da seção Experiência (UX) (P-SEN-18 a P-SEN-25)._

### Contexto e objetivo
**No legado:**
- A senha fica no formulário do membro, na parte "Acesso", com os campos "Senha" e "Confirmar Senha". Se as duas não conferem, a mensagem é "Senhas não conferem".
- Quem troca a senha de quem:
  - o próprio membro, no próprio cadastro;
  - o administrador e o administrador geral, nos cadastros que eles veem.
- No cadastro novo, a senha inicial é obrigatória e é escolhida por quem cadastra.
- Não há tamanho mínimo, senha atual, troca obrigatória nem "esqueci minha senha". Quem esquece a senha pede a um administrador que defina outra.

**No novo, hoje** (conferido na `origin/main` em 2026-11-23):
- A função `change-member-password` existe, mas não está publicada em produção (fica fora da lista de publicação até este passo).
  - Ela valida a sessão e exige "Alterar Senha de Membros" ou "Gerenciar Funções".
  - Ela aceita qualquer membro: não confere se quem chama vê o alvo, se cobre a função dele nem se o cadastro foi excluído. Quem tem a permissão troca a senha de um administrador.
  - Quem chama escolhe a nova senha (mínimo de 6 caracteres). A pessoa não precisa trocá-la depois, e as sessões abertas dela continuam.
  - A Auditoria registra "Senha alterada".
- No cadastro de membro:
  - na edição, o botão "Alterar Senha" aparece só com a permissão e abre o diálogo "Nova Senha". O botão aparece também no próprio cadastro;
  - no cadastro novo, o campo "Senha para Acesso" é opcional. Sem senha, a inicial é `123456` (D11).
- O próprio membro não troca a própria senha sem a permissão "Alterar Senha de Membros".
- Não há troca obrigatória, política de senha nem recuperação de senha.
- Depois do E2.02, só a função Administrador tem a permissão (RN-16 e RN-17 de lá).
- Depois do E1.04, o provedor de e-mail e senha do Auth fica desligado (DT-01 de lá): a recuperação padrão (`/recover`) deixa de funcionar, e a troca de senha pela sessão do próprio usuário no Auth (`PUT /user`) continua aberta.

**Objetivo do passo:**
- permitir que o líder ou o administrador redefina a senha de um membro que ele vê, com uma senha temporária, sem depender de e-mail;
- impedir que alguém redefina a senha de quem tem mais permissões, de um cadastro excluído ou de fora do que vê;
- obrigar a troca da senha no primeiro acesso depois de uma senha definida por outra pessoa (a inicial `123456`, a temporária e, no E3.02, a senha antiga fraca);
- definir a política de senha, que vale para toda senha escolhida a partir daqui;
- permitir que todo membro troque a própria senha, informando a atual;
- registrar na Auditoria as redefinições, as trocas e as falhas, sem a senha;
- publicar a função de redefinição em produção.

### Termos
- **Conta de acesso:** a conta no Supabase Auth ligada ao cadastro do membro. É nela que fica a senha (E1.04).
- **Redefinição de senha:** quando outra pessoa (o líder ou o administrador) troca a senha de um membro. O membro recebe uma senha temporária. No legado, era a troca feita pelo administrador.
- **Senha temporária:** a senha que o sistema gera na redefinição. Ela vale por um prazo (RN-05) e só serve para chegar à troca obrigatória.
- **Senha inicial:** a senha com que a conta nasce no cadastro feito pelo app: `123456` (D11) ou a que quem cadastra digitar.
- **Troca de senha:** quando o próprio membro troca a senha.
  - **Troca obrigatória:** a que o sistema exige depois de entrar, antes de qualquer outra tela (RN-10).
  - **Troca voluntária:** a que o membro faz quando quer, em "Alterar minha senha" (RN-11).
- **Marca de troca obrigatória:** a indicação, na conta de acesso, de que a próxima coisa que a pessoa precisa fazer é trocar a senha. No plano, `must_change_password`.
- **Política de senha:** as regras que uma senha nova precisa cumprir (RN-13).
- **Senha atual:** a senha que a conta tem no momento: a escolhida pelo membro, a inicial ou a temporária.
- **Ver / visível**, **cobrir a função** e **Administrador:** como no E2.02. Cobrir a função é ter todas as permissões dela. Só a função Administrador cobre a Administrador (RN-17 do E2.02).
- **Sessão:** cada aparelho ou navegador em que a pessoa está conectada. **Encerrar uma sessão** quer dizer que, na próxima ação naquele aparelho, ela volta para o login.

Os prazos deste spec contam em horas e minutos corridos, no horário de Brasília quando aparecem na tela. Eles não dependem do dia nem da semana.

### Personas e permissões
A massa de exemplo está nos [Critérios de aceite](#massa-de-exemplo). "Redefinir Senha de Membros" é o novo rótulo de `change_member_password` (RN-01).

| Persona | Na massa | Função | Neste spec |
|---|---|---|---|
| AD Administrador | Rita e Olga | Administrador | redefine a senha de qualquer membro, inclusive de outro administrador; troca a própria |
| PA Pastor | Samuel e Magda (casal) | Líder | redefine a senha de quem vê, se cobrir a função; é alvo de quem o vê |
| G12 | Pedro e Paula (casal) | Líder | redefine no próprio ministério |
| LE Líder | André, casado com Beatriz, que é de outro ministério | Líder | redefine a senha da cônjuge e dos discípulos; não a de uma administradora |
| OM Líder de outro ministério | Diego | Líder | não alcança quem está fora do que ele vê |
| MB Membro | Caio | Membro | não redefine; troca a própria senha; é alvo |
| IN Inativo | Fábio | Membro | é alvo, entra e troca a senha normalmente |
| SL Sem liderança | Ester | Membro | só quem vê a igreja toda redefine a senha dela |
| SF Sem função | Hugo | nenhuma | troca a própria senha; não redefine |
| SC Sem conta de acesso | Lauro | Membro | não pode ser alvo: não tem senha |
| X Excluído | Nina | Membro | não pode ser alvo; não entra (E2.01) |
| AU Quem audita | Rita | Administrador | vê as redefinições, as trocas e as falhas na Auditoria |

Uma conta de acesso sem cadastro de membro não entra pela `sign-in` (RN-06 do E1.04), então não participa deste spec. O consolidado ainda não existe (ver Fora de escopo).

### Histórias
- Como membro que esqueceu a senha e não tem e-mail, quero pedir ao meu líder uma senha nova, para voltar a entrar.
- Como líder, quero gerar uma senha temporária para um discípulo e passá-la a ele, sem poder ver nem escolher a senha que ele vai usar depois.
- Como igreja, quero que ninguém redefina a senha de quem tem mais permissões, nem de quem está fora do seu ministério, para que um líder não tome a conta de um administrador.
- Como membro, quero trocar a minha senha quando eu quiser, e que ninguém com o meu celular desbloqueado consiga trocá-la sem saber a senha atual.
- Como membro cadastrado com a senha `123456`, quero ser levado a criar a minha própria senha no primeiro acesso.
- Como igreja, quero que as senhas novas não sejam fáceis de adivinhar, porque o login aceita o CPF e o celular, que muita gente conhece.
- Como quem audita, quero ver quem redefiniu a senha de quem e as tentativas recusadas.

### Decisões

#### Decisões do usuário e de passos anteriores
| Decisão | O que vale aqui | Onde |
|---|---|---|
| D11 (2026-11-15) | Sem senha digitada no cadastro, a senha inicial é `123456`. A decisão não é reaberta: este passo só acrescenta a troca obrigatória no primeiro acesso. | RN-07, RN-08 |
| D5 (2026-11-23) | A pessoa entra com o e-mail real, o celular ou o CPF. A senha temporária vale com qualquer um deles. | RN-03 |
| D6 (2026-11-23) | A senha antiga do legado não tem prazo. A redefinição a substitui. | RN-04 |
| D7 (2026-11-23) | Os e-mails fictícios ficam num domínio da igreja: o que for mandado para eles chega a quem controla o domínio, e não ao membro (seção 2 do plano). Por isso o sistema não manda a senha temporária por e-mail. | RN-03 |
| D1, e as RN-07 e RN-14 do E2.01 | O cadastro excluído não tem a senha trocada e não entra. A conta dele fica suspensa (DT-13 do E2.01). | RN-02, RN-11 |
| P-DEL-21 do E2.01 | "Sua sessão terminou. Entre de novo para continuar." vale para qualquer fim forçado de sessão. | RN-16 |
| E2.02 (RN-01 a RN-04, RN-09, RN-17 e RN-18; P-PER-08 e Fora de escopo) | O alvo precisa estar visível, e quem redefine precisa cobrir a função dele. Só a Administrador cobre a Administrador. O E2.03 decide quando a Líder recebe a permissão e como o próprio membro troca a senha. | RN-01, RN-02, RN-11 |
| E1.04 (RN-07, RN-09 a RN-12, RN-14, RN-15 e RN-17; DT-01) | A mensagem única do login, a senha usada como foi digitada, os limites de tentativas, o caminho único, a Auditoria do login e o ponto do E3.02. O provedor de e-mail e senha do Auth fica desligado, e o `/recover` padrão junto com ele. | RN-05, RN-08, RN-12, RN-14, RN-15, RN-17 |
| 6.3 e 6.4 do plano | A marca de troca obrigatória e a tela de troca "antes de qualquer outra". A redefinição assistida, com senha temporária e escopo, é o caminho de quem só tem celular. | RN-03, RN-04, RN-08 a RN-10 |
| 6.5 do plano | A Líder tem a redefinição assistida. | RN-01 |
| 6.7 do plano | Em caso de problema, o caminho é falar com o próprio líder. | RN-15 |
| E1.07 (sem credenciais) | Não há envio de e-mail neste passo. | RN-03, RN-15 |

#### Padrões definidos por este spec (revisar no PR)
Estes pontos não estão nas fontes. O PO adotou a opção mais conservadora e coerente com o legado, com o E1.04 e com o E2.02. Nas regras, eles aparecem como "definida pelo spec", e o usuário pode mudar qualquer um na revisão do PR.

- **P-SEN-01, nome da permissão.** "Alterar Senha de Membros" passa a se chamar "Redefinir Senha de Membros", com uma dica, porque quem a usa não escolhe mais a senha (RN-01).
- **P-SEN-02, a própria senha não é redefinida.** Ninguém redefine a própria senha, nem o administrador. Para a própria senha, vale a troca voluntária, que pede a senha atual (RN-02).
- **P-SEN-03, senha temporária gerada pelo sistema** (RN-03):
  - quem redefine não escolhe a senha;
  - 8 caracteres, só letras minúsculas e números, sem os que se confundem ao ditar ou ler (0, 1, i, l, o);
  - ela aparece uma vez só, para quem redefiniu, que a passa ao membro pessoalmente ou por mensagem direta;
  - o sistema não envia a senha por e-mail, SMS nem WhatsApp.
- **P-SEN-04, a redefinição vale na hora** (RN-04):
  - a senha anterior para de funcionar no mesmo instante, inclusive uma senha temporária anterior e, a partir do E3.02, a senha antiga do legado ainda não usada;
  - a redefinição não termina o bloqueio por tentativas do login. Fica como o E1.04 decidiu (RN-12 e P-LOG-07 de lá): o bloqueio termina sozinho, em até 15 minutos.
- **P-SEN-05, validade da senha temporária:** 7 dias (168 horas corridas), o ritmo semanal da célula. Depois disso, ela não entra mais, e é preciso uma nova redefinição (RN-05).
- **P-SEN-06, limite de redefinições:** cada pessoa faz no máximo 20 redefinições em 60 minutos. Isso limita o estrago de uma conta de líder invadida (RN-06).
- **P-SEN-07, senha inicial** (RN-07):
  - toda conta criada pelo app nasce com a marca de troca obrigatória, com `123456` ou com a senha que quem cadastra digitar;
  - a senha digitada por quem cadastra segue a política. A `123456` da D11 é a única exceção;
  - a senha inicial não vence, para não mudar a D11.
- **P-SEN-08, troca exigida no login** (RN-08):
  - quem entra com uma senha fora da política entra e é levado à troca obrigatória. Isso pega a `123456`, as senhas fracas gravadas antes deste passo e, no E3.02, a senha antiga fraca do legado;
  - na publicação deste passo, as contas que ainda usam a senha `123456` recebem a marca, inclusive as que estão com a sessão aberta.
- **P-SEN-09, antes de trocar, nada mais** (RN-09). Com a marca, a pessoa só troca a senha ou sai. Isso vale no servidor, e não só na tela, e vale na hora, inclusive para uma sessão já aberta.
- **P-SEN-10, a troca obrigatória não pede a senha atual** (RN-10). A sessão que tem a marca vem de um login feito com a senha atual, ou a senha atual é a `123456`, que todo mundo conhece. Sem a marca, a troca sem a senha atual é recusada.
- **P-SEN-11, troca voluntária** (RN-11):
  - qualquer membro com conta troca a própria senha, sem depender de função nem de permissão;
  - a troca pede a senha atual, para que um aparelho desbloqueado não baste para tomar a conta.
- **P-SEN-12, limite da senha atual** (RN-12):
  - 5 erros em 15 minutos, na mesma conta, bloqueiam a troca voluntária por 15 minutos;
  - cada erro conta também no limite por origem do login (RN-11 do E1.04);
  - o bloqueio não encerra a sessão nem bloqueia o login.
- **P-SEN-13, política de senha** (RN-13):
  - no mínimo 8 caracteres e no máximo 72 bytes;
  - qualquer caractere vale, inclusive espaço e acento, e não se exige maiúscula, número nem símbolo;
  - são proibidas: a senha com todos os caracteres iguais, a sequência simples, as senhas comuns (listas públicas e palavras do contexto da igreja) e a senha com o CPF, o celular, a data de nascimento ou o e-mail do próprio membro;
  - na troca, a senha nova precisa ser diferente da atual;
  - não há validade periódica de senha.
- **P-SEN-14, caminho único da troca** (RN-14). A senha só muda pelos caminhos deste spec, do cadastro e, no futuro, do E3.02 e do E1.07. Trocar a senha direto no Auth, com a sessão do próprio usuário, é recusado. Sem isso, a senha atual, a política, os limites e a Auditoria poderiam ser contornados. É o mesmo raciocínio da P-LOG-08 do E1.04.
- **P-SEN-15, "esqueci minha senha" até o E1.07** (RN-15). A tela de login ganha o texto "Esqueceu a senha? Fale com o seu líder.", sem link e sem envio. A recuperação por e-mail fica para o E1.07.
- **P-SEN-16, sessões** (RN-16):
  - a redefinição encerra todas as sessões do alvo;
  - a troca, voluntária ou obrigatória, encerra as outras sessões da pessoa e mantém a sessão em que a troca foi feita;
  - nos dois casos, o encerramento vale na hora.
- **P-SEN-17, Auditoria** (RN-17):
  - a Auditoria registra a redefinição, a redefinição recusada, a troca, a falha da senha atual, o bloqueio da troca e a marca posta no login ou na publicação;
  - a redefinição e a troca só acontecem junto com o registro;
  - nenhuma senha vai para a Auditoria.
- **Vindos do desenho de UX (2026-11-23, PO-UX-1 a PO-UX-8 em "Experiência (UX)"):**
  - **P-SEN-18, compartilhar só a senha** (PO-UX-1). "Copiar senha" e "Compartilhar senha" levam só os 8 caracteres, sem saudação, validade, endereço do sistema nem dados do membro. Assim, o membro que copiar tudo o que recebeu e colar no campo de senha entra, sem gastar tentativa do bloqueio, e a mensagem não tem o formato "senha + endereço" que um golpe poderia imitar. Quem redefiniu explica o resto na conversa (RN-03).
  - **P-SEN-19, "Alterar minha senha" também no próprio cadastro** (PO-UX-2), na seção Acesso, onde o legado tinha a senha. O diálogo é o mesmo do menu (RN-11).
  - **P-SEN-20, "Redefinir senha" também na lista de Membros** (PO-UX-3), nas ações de cada linha ou card, para quem tem a permissão. Quem tem "Redefinir Senha de Membros" sem "Editar Membro" alcança a ação pela lista (RN-01).
  - **P-SEN-21, senha inicial na seção Acesso** (PO-UX-4), com o nome "Senha inicial (opcional)", "Mostrar senha" e sem "Confirmar senha". A dica e o erro dos dados pessoais falam do membro, e não de quem cadastra (RN-07, RN-13).
  - **P-SEN-22, "Concluir" sem confirmação** (PO-UX-5). A tela da senha temporária fecha só por "Concluir", sem perguntar, mesmo que a senha não tenha sido copiada. Se ela não foi passada, redefine-se de novo (RN-03, RN-04).
  - **P-SEN-23, ajuda depois do primeiro erro da senha atual** (PO-UX-6): "Se não lembra a senha atual, fale com o seu líder." (RN-11, RN-15).
  - **P-SEN-24, marca posta durante o uso** (PO-UX-7). Sem mudança nas RNs: a pessoa vai para a troca sem aviso, o que não foi gravado se perde, e depois da troca ela vai para a tela inicial. Para reduzir o efeito, a publicação deste passo é feita fora das noites de célula (Impactos, Deploy).
  - **P-SEN-25, textos da UX** (PO-UX-8): aceitos e copiados para os Textos de tela.

### Regras de negócio
Nenhuma regra está "a confirmar". Os caminhos do legado são relativos a `g12app-net/` e usam as mesmas abreviações dos specs anteriores:
- `App/` = `G12App.Application/`;
- `Domain/` = `G12App.Domain/`;
- `UI/` = `G12App.API/ClientApp/src/`;
- `Infra/` = `G12App.Infrastructure.Data/`.

| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Quem redefine.**<br>- Redefine a senha de outro membro quem tem "Redefinir Senha de Membros" (`change_member_password`), sempre com a RN-02.<br>- Nas funções semeadas:<br>  - a Administrador tem a permissão, como todas (RN-17 do E2.02);<br>  - a **Líder passa a ter** a permissão neste passo;<br>  - a Membro não tem.<br>- "Gerenciar Funções" sozinha não dá mais o direito de redefinir. A Administrador continua redefinindo porque tem todas as permissões.<br>- Na tela de Funções, o rótulo passa de "Alterar Senha de Membros" para "Redefinir Senha de Membros", com a dica dos Textos de tela.<br>- A ação "Redefinir senha" fica em dois lugares: no cadastro do membro e na lista de Membros, nas ações de cada linha ou card. Pela lista, quem tem a permissão sem "Editar Membro" também redefine.<br>- Sem a permissão, a tela não mostra a ação, e a chamada pela API é recusada. | AUT-06; legado (`Domain/Mappings/DomainToDTOMappingProfile.cs:45-50`: a senha só é gravada pelo próprio membro ou por quem tem `AppAdmin` ou `AppSuperAdmin`, `Domain/Extensions/UserExtensions.cs:9-13`); 6.4 e 6.5 do plano (a Líder com a redefinição assistida); 6.7 ("falar com o próprio líder"); E2.02 (P-PER-08 e Fora de escopo: o E2.03 decide); sem o atalho de "Gerenciar Funções": consequência da RN-17 do E2.02; rótulo: definida pelo spec (P-SEN-01); ação na lista: P-SEN-20 |
| RN-02 | **De quem se redefine a senha.** A redefinição só é aceita quando:<br>(a) o alvo está visível para quem redefine, com o escopo do E2.02 (RN-01 a RN-05 e o item a da RN-09 de lá). O alvo fora do que a pessoa vê é tratado como inexistente;<br>(b) o alvo não está excluído (RN-07 do E2.01). A conta suspensa dele não é mexida;<br>(c) o alvo não é quem redefine (P-SEN-02);<br>(d) quem redefine cobre a função do alvo (RN-18 do E2.02). Assim, só a Administrador redefine a senha de uma administradora. O membro sem função pode ser alvo de qualquer um que o veja;<br>(e) o alvo tem conta de acesso.<br><br>Nada mais é exigido: o alvo inativo, o pastor, o cônjuge e quem está sem liderança podem ser alvo de quem os vê. Também pode ser alvo o líder ou o G12 de quem redefine, quando estão visíveis e a função deles é coberta, como no legado.<br><br>**Ordem das recusas**, cada uma com o seu texto (Textos de tela):<br>1. sem a permissão (RN-01);<br>2. acima do limite (RN-06);<br>3. alvo não visível ou excluído: o mesmo texto para os dois;<br>4. o próprio cadastro;<br>5. função não coberta;<br>6. sem conta de acesso.<br><br>Em qualquer recusa, nada muda, e a Auditoria registra a recusa (RN-17). | AUT-06 ("para membros do escopo dele"); E2.02 (RN-01 a RN-05, RN-09 e RN-18; Fora de escopo: "o E2.03 aplica ao alvo"); E2.01 (RN-07; DT-12, `viewer_covers_role`; DT-13); "nunca a de um administrador": RN-17 do E2.02; sem conta: a `change-member-password` atual ("Este membro não possui acesso ao sistema"); legado (o formulário de membro só abre cadastros do escopo: `Infra/Repositories/MemberRepository.cs:44-51`); próprio cadastro e ordem: definida pelo spec (P-SEN-02) |
| RN-03 | **A senha temporária.**<br>- O sistema gera a senha. Quem redefine não a escolhe.<br>- Formato: 8 caracteres, só letras minúsculas (sem acento) e números, sem 0, 1, i, l e o. Ela sempre atende à política (RN-13).<br>- Ela aparece uma vez só, na tela de quem redefiniu, com a validade (RN-05) no horário de Brasília, o botão "Copiar senha" e, quando o aparelho oferece o compartilhamento, o botão "Compartilhar senha".<br>- Copiar e compartilhar levam só os 8 caracteres, sem nenhum outro texto: nem saudação, nem nome, nem validade, nem endereço do sistema, nem dados do membro.<br>- A tela fecha só por "Concluir", sem pedir confirmação, mesmo que a senha não tenha sido copiada. Depois que ela fecha, ninguém vê a senha de novo, nem quem redefiniu, nem um administrador, nem pela API. Se a senha não foi passada ao membro, redefine-se de novo (RN-04).<br>- O sistema não envia a senha. Quem redefiniu a passa ao membro pessoalmente ou por mensagem direta, porque muitos membros não têm e-mail real. O compartilhamento abre o do próprio aparelho, e quem escolhe o contato e explica o resto na conversa é quem redefiniu.<br>- O membro entra com qualquer identificação dele (e-mail real, celular ou CPF, D5) e a senha temporária. Em seguida, vem a troca obrigatória (RN-10).<br>- A senha temporária nunca é gravada em lugar legível, nem registrada na Auditoria ou nos logs (RN-17). | 6.4 do plano ("define uma senha temporária"; "o caminho para quem só tem celular"); D5; D7; E1.07 sem credenciais; geração, formato e exibição única: definida pelo spec (P-SEN-03); só a senha no copiar e no compartilhar: P-SEN-18; "Concluir" sem confirmação: P-SEN-22 |
| RN-04 | **O que a redefinição muda.**<br>- A senha anterior do alvo para de funcionar na hora, qualquer que seja: a escolhida por ele, a inicial, uma temporária anterior e, a partir do E3.02, a senha antiga do legado ainda não usada (6.3).<br>- A conta do alvo recebe a marca de troca obrigatória (RN-08).<br>- Todas as sessões abertas do alvo são encerradas (RN-16).<br>- O bloqueio por tentativas do login (RN-10 a RN-12 do E1.04) não termina com a redefinição. Ele termina sozinho, no prazo de sempre.<br>- Nada mais muda: o cadastro, a função, a situação e o e-mail da conta de acesso ficam como estavam.<br>- Duas redefinições do mesmo membro, uma depois da outra ou ao mesmo tempo: vale a última, e a senha temporária anterior deixa de funcionar. As duas ficam na Auditoria. | 6.4 do plano ("grava a senha e marca `must_change_password`"); E1.04 (RN-12 e P-LOG-07: o bloqueio termina sozinho, sem desbloqueio manual; Impactos: a redefinição "neste passo, não termina" o bloqueio); senha legada: 6.3 e D6; demais: definida pelo spec (P-SEN-04) |
| RN-05 | **Validade da senha temporária.**<br>- A senha temporária vale por 7 dias (168 horas corridas) a partir da redefinição. A virada da semana não muda nada.<br>- Dentro do prazo, ela entra quantas vezes for preciso e sempre leva à troca obrigatória, até a troca ser feita.<br>- Depois do prazo, ela não entra mais. A tentativa recebe a mensagem única do login, conta para os limites do E1.04, e a Auditoria registra a falha com o motivo "Senha temporária vencida" quando a senha digitada era a temporária. Com outra senha, o motivo é "Senha incorreta", como hoje.<br>- Vencida a senha, a conta fica sem senha válida até uma nova redefinição.<br>- A senha inicial (RN-07) não vence. | pedido do passo (validade); E1.04 (RN-07, a resposta única; RN-15, o motivo só para quem audita); prazo: definida pelo spec (P-SEN-05) |
| RN-06 | **Limite de redefinições.**<br>- Cada pessoa faz no máximo 20 redefinições aceitas em qualquer janela de 60 minutos.<br>- A 21ª é recusada com a mensagem de limite, com os minutos que faltam até a redefinição mais antiga sair da janela, arredondados para cima ("1 minuto" no singular).<br>- Só as redefinições aceitas contam. As recusas não contam.<br>- Redefinições simultâneas não passam do limite: de 25 enviadas ao mesmo tempo pela mesma pessoa, no máximo 20 são aceitas.<br>- Se não for possível contar, a redefinição é recusada com o erro de conexão, e nada muda. | definida pelo spec (P-SEN-06) |
| RN-07 | **Senha inicial do cadastro** (D11).<br>- Sem senha digitada, a senha inicial é `123456`, como hoje. Digitar `123456` dá no mesmo.<br>- A senha que quem cadastra digitar, diferente de `123456`, segue a política (RN-13), com os dados que estão sendo cadastrados (CPF, celular, data de nascimento e e-mail).<br>- Nos dois casos, a conta nasce com a marca de troca obrigatória (RN-08).<br>- A senha inicial não vence.<br>- O campo fica na seção Acesso do cadastro novo, com o nome "Senha inicial (opcional)", "Mostrar senha" e sem "Confirmar senha".<br>- A dica e as mensagens falam do membro que está sendo cadastrado, e não de quem cadastra: "não use o CPF, o celular ou a data de nascimento do membro" (Textos de tela). | D11 (2026-11-15); legado (`UI/pages/Members/details.js:165-166`: a senha inicial é escolhida por quem cadastra); marca, política na senha digitada e sem prazo: definida pelo spec (P-SEN-07); seção Acesso, sem confirmação e textos sobre o membro: P-SEN-21 |
| RN-08 | **Quando a troca é exigida.** A conta recebe a marca de troca obrigatória quando:<br>(a) a senha foi definida por outra pessoa: no cadastro (RN-07) e na redefinição (RN-04);<br>(b) a pessoa entra com uma senha que não atende à política (RN-13, sem a regra de "diferente da atual"). A pessoa entra normalmente, e o login não é recusado por isso (RN-17 do E1.04);<br>(c) na publicação deste passo, a senha atual da conta é `123456`, inclusive com a sessão aberta;<br>(d) a partir do E3.02, a pessoa entra pela primeira vez com uma senha antiga do legado que não atende à política (6.3).<br><br>Detalhes:<br>- A marca não depende da função, da situação (ativo ou inativo) nem de ser pastor.<br>- A marca só sai com uma troca de senha concluída (RN-10 ou RN-11). Sair, entrar de novo, ser excluído e ser restaurado não a tiram. A restauração devolve a mesma senha e a mesma marca (RN-16 f do E2.01).<br>- Quem tem a marca e entra de novo volta para a troca obrigatória, sem um novo registro na Auditoria.<br>- A conta criada pela carga com uma senha aleatória que ninguém conhece (6.2) não recebe a marca. | 6.3 do plano (senha legada fora da política); 6.4 (redefinição); D11; E1.04 (Impactos: "a troca obrigatória do E2.03 pode cobrir as contas criadas com a senha inicial"); itens (b) e (c) e a permanência da marca: definida pelo spec (P-SEN-07, P-SEN-08) |
| RN-09 | **Antes de trocar.** Depois de entrar, a pessoa com a marca:<br>(a) vê só a tela de troca obrigatória (RN-10), qualquer que seja o endereço aberto. Ela pode trocar a senha ou sair;<br>(b) não lê nem grava nada, nem pela API: membros, células, relatórios, funções, Dashboard, Ministérios, Auditoria e as funções de cadastro e de redefinição. A API responde com erro de permissão;<br>(c) a regra vale na hora: a partir do momento em que a marca é posta, a próxima ação já é recusada, inclusive numa sessão que estava aberta, e a tela leva para a troca obrigatória, sem mensagem de erro;<br>(d) a regra vale para qualquer função, inclusive a Administrador. | 6.3 do plano ("uma tela de troca obrigatória antes de qualquer outra"); princípio do `CLAUDE.md` (regra só na tela pode ser contornada); "na hora": coerente com a RN-08 do E2.02 e a RN-14 do E2.01; no servidor: definida pelo spec (P-SEN-09) |
| RN-10 | **Troca obrigatória.**<br>- A tela pede a nova senha e a confirmação. Ela não pede a senha atual (P-SEN-10).<br>- A troca sem a senha atual só é aceita enquanto a conta tem a marca. Sem a marca, ela é recusada com erro de permissão, e nada muda.<br>- A nova senha segue a política (RN-13) e precisa ser diferente da senha com que a pessoa entrou.<br>- Se a confirmação não confere, nada é gravado.<br>- Ao concluir:<br>  - a senha muda e a marca sai, juntas;<br>  - a sessão em que a troca foi feita continua, e as outras sessões da pessoa são encerradas (RN-16);<br>  - a pessoa segue para a tela inicial;<br>  - a Auditoria registra a troca, do tipo "Obrigatória" (RN-17).<br>- Se a pessoa sair sem trocar, a marca continua, e a próxima entrada volta para esta tela. | 6.3 e 6.4 do plano; confirmação: legado (`UI/pages/Members/details.js:149-152`, "Senhas não conferem"); sem senha atual: definida pelo spec (P-SEN-10); sessões: P-SEN-16 |
| RN-11 | **Troca voluntária.**<br>- Todo membro com conta de acesso troca a própria senha, em "Alterar minha senha". A ação fica em dois lugares, que abrem a mesma tela: o menu da própria pessoa e a seção Acesso do próprio cadastro ("Editar meus dados" ou "Ver meus dados"). No próprio cadastro, "Redefinir senha" nunca aparece.<br>- Não depende de função nem de permissão. Vale para o inativo, o pastor, quem está sem liderança e quem está sem função. Trocar a própria senha não é alterar o cadastro (RN-07 e RN-11 do E2.02).<br>- A tela pede a senha atual, a nova senha e a confirmação.<br>- O servidor confere primeiro a senha atual (RN-12). Errada, a resposta é "A senha atual não confere.", e nada muda. A partir do primeiro erro, a tela orienta: "Se não lembra a senha atual, fale com o seu líder." (o caminho da RN-15).<br>- Com a senha atual certa, a nova segue a política (RN-13), é diferente da atual, e a confirmação precisa conferir.<br>- Ao concluir:<br>  - a senha muda na hora;<br>  - a sessão em que a troca foi feita continua, e as outras sessões da pessoa são encerradas (RN-16);<br>  - se a conta tinha a marca, ela sai;<br>  - a Auditoria registra a troca, do tipo "Voluntária" (RN-17).<br>- A troca não muda o cadastro nem o e-mail da conta de acesso.<br>- O membro excluído não troca a senha, porque não entra (RN-14 do E2.01). | AUT-06 ("trocada pelo próprio membro"); legado (`UI/pages/Members/details.js:74` e `:507-528`: o próprio membro troca a senha no próprio cadastro, com confirmação); E2.02 (RN-11: "a troca da própria senha é do E2.03"); senha atual e sem permissão: definida pelo spec (P-SEN-11); no próprio cadastro: P-SEN-19; ajuda depois do erro: P-SEN-23 |
| RN-12 | **Limite da senha atual.**<br>- 5 erros da senha atual na mesma conta, em até 15 minutos, sem uma troca concluída entre eles, bloqueiam a troca voluntária dessa conta por 15 minutos, contados do 5º erro. A 5ª tentativa errada já recebe a mensagem de bloqueio.<br>- Durante o bloqueio:<br>  - a senha atual não é conferida, nem se estiver certa;<br>  - a tentativa recebe a mensagem de bloqueio e não estende o bloqueio.<br>- Uma troca concluída zera a contagem.<br>- Cada erro também conta no limite por origem do login (RN-11 do E1.04). Durante um bloqueio da origem, a troca voluntária feita dessa origem recebe a mensagem de bloqueio, sem conferir a senha.<br>- O bloqueio da troca:<br>  - não encerra a sessão;<br>  - não bloqueia o login, que segue os próprios limites (RN-10 do E1.04);<br>  - não muda a senha.<br>- Tentativas simultâneas não passam do limite: de 20 enviadas ao mesmo tempo com a senha atual errada, no máximo 5 têm a senha conferida.<br>- Se não for possível contar a tentativa, ela é recusada com o erro de conexão, sem conferir a senha.<br>- Erros na senha nova (política ou confirmação) não contam. | E1.04 (RN-17 c: toda conferência de senha herda os limites; RN-10 e RN-11); números, contagem por conta e mensagem: definida pelo spec (P-SEN-12) |
| RN-13 | **Política de senha.** Uma senha nova é aceita só quando cumpre todas as regras:<br>(a) **tamanho:** pelo menos 8 caracteres e no máximo 72 bytes em UTF-8. Uma letra sem acento ocupa 1 byte, uma letra com acento ocupa 2, e um emoji ocupa 4;<br>(b) **caracteres:** qualquer um, inclusive espaço e acento. A senha é usada exatamente como foi digitada (RN-09 do E1.04). Não se exige maiúscula, número nem símbolo;<br>(c) **repetição:** os caracteres não podem ser todos iguais (por exemplo, `11111111` ou 8 espaços);<br>(d) **sequência:** a senha não pode ser uma sequência simples, crescente ou decrescente, só de números (`12345678`, `87654321`) ou só de letras (`abcdefgh`);<br>(e) **senhas comuns:** a senha não pode estar na lista de senhas comuns do sistema, sem diferenciar maiúsculas. A lista tem pelo menos as 10.000 senhas mais comuns de listas públicas de vazamentos;<br>(f) **palavras do contexto:** sem diferenciar maiúsculas nem acentos, a senha não pode ser uma destas palavras, sozinha ou seguida só de números e símbolos: `senha`, `mudar`, `igreja`, `mci`, `mci12`, `mci12rs`, `g12` e `connect`. Exemplos: `Senha123`, `igreja@2024`, `MCI12rs2025`;<br>(g) **dados do próprio membro:** sem pontos, traços, barras e espaços, a senha não pode conter:<br>  - os 11 dígitos do CPF;<br>  - os 8 últimos dígitos do celular;<br>  - a data de nascimento no formato ddmmaaaa.<br><br>  Ela também não pode ser igual ao e-mail do cadastro, sem diferenciar maiúsculas. O dado que o cadastro não tem não é conferido;<br>(h) **na troca:** a senha nova é diferente da senha atual.<br><br>Onde vale:<br>- Vale na troca obrigatória, na troca voluntária e na senha inicial digitada (RN-07). A senha temporária já nasce dentro da política (RN-03).<br>- A `123456` da D11 é a única exceção, e só como senha inicial.<br>- No login, a política não recusa ninguém: ela só decide a marca (RN-08 b).<br>- A tela mostra as regras antes de enviar e aponta a regra que falhou. Quem decide é o servidor, que confere tudo de novo.<br>- Nas trocas, as mensagens falam com a própria pessoa ("o seu CPF"). Na senha inicial, falam do membro que está sendo cadastrado (RN-07).<br>- Não há validade periódica: a senha escolhida vale até a pessoa trocá-la ou alguém redefini-la. | 6.3 do plano ("se a senha atende à política"); E1.04 (RN-09: a senha como foi digitada; DA-5: acima de 72 bytes, a senha nunca confere); legado sem política (`UI/pages/Members/details.js:149-152`); regras: definida pelo spec (P-SEN-13); mensagens da senha inicial: P-SEN-21 |
| RN-14 | **Caminho único da troca.** A senha de uma conta só muda por estes caminhos:<br>- a senha inicial, no cadastro (RN-07);<br>- a redefinição (RN-01 a RN-06);<br>- a troca obrigatória (RN-10);<br>- a troca voluntária (RN-11);<br>- no futuro, a primeira entrada com a senha do legado (E3.02) e a recuperação por e-mail (E1.07), que seguem a política e a Auditoria deste spec.<br><br>Pela API, trocar a senha direto no Auth com a sessão do próprio usuário é recusado, mesmo com a senha certa. Sem isso, a senha atual (RN-11), a política (RN-13), os limites (RN-12) e a Auditoria (RN-17) poderiam ser contornados.<br><br>A regra não vale para a operação com a chave secreta (painel do Supabase e scripts da migração), que não é caminho de uso. | E1.04 (RN-14 e DT-01: o `PUT /user` continua aberto com o provedor de e-mail desligado); definida pelo spec (P-SEN-14) |
| RN-15 | **Esqueci minha senha (até o E1.07).**<br>- Neste passo, não há recuperação de senha por e-mail.<br>- A tela de login mostra o texto "Esqueceu a senha? Fale com o seu líder.". Ele não é um link, não envia nada e não depende do que foi digitado.<br>- O caminho é a redefinição (RN-01 a RN-04), feita por quem tem a permissão e vê o membro. Se o líder direto não tem a permissão, ele pede a quem tem, acima dele.<br>- A recuperação padrão do Auth continua desligada (DT-01 do E1.04): pedir a recuperação pela API não envia nada e não troca a senha.<br>- A mensagem de bloqueio do login continua como no E1.04 ("Se esqueceu a senha, fale com o seu líder."). | 6.7 do plano; E1.04 (RN-12 e DT-01); E1.07 (sem credenciais); legado sem recuperação (`UI/pages/Login/index.js`); texto: definida pelo spec (P-SEN-15) |
| RN-16 | **Sessões.**<br>- **Redefinição:** todas as sessões abertas do alvo são encerradas.<br>- **Troca obrigatória ou voluntária:** a sessão em que a troca foi feita continua. As outras sessões da mesma pessoa são encerradas.<br>- **Na hora:** a partir do encerramento, nenhuma leitura ou gravação feita com a sessão encerrada é aceita, nem pela API. A tela leva para o login com "Sua sessão terminou. Entre de novo para continuar." (P-DEL-21 do E2.01, que vale para qualquer fim forçado de sessão e não revela o motivo).<br>- Nada mais encerra sessões neste passo: o bloqueio da troca (RN-12), o vencimento da senha temporária (RN-05) e a marca posta na publicação (RN-08 c) não encerram. Na publicação, a sessão aberta continua, mas só para a troca obrigatória (RN-09).<br>- As sessões de quem redefiniu não mudam. | E2.01 (RN-14 e P-DEL-21); E1.04 (RN-12: o bloqueio não encerra sessões); demais: definida pelo spec (P-SEN-16) |
| RN-17 | **Auditoria.** Tudo é registrado pelo servidor, com quando e quem fez:<br>(a) **Senha redefinida:** quem redefiniu, o membro alvo e a validade da senha temporária;<br>(b) **Redefinição de senha recusada:** quem tentou, o alvo quando ele existe, e o motivo: Sem permissão, Limite de redefinições, Fora do que a pessoa vê, Cadastro excluído, Própria senha, Função não coberta ou Sem conta de acesso;<br>(c) **Senha alterada:** o próprio membro e o tipo, Obrigatória ou Voluntária;<br>(d) **Falha na troca de senha:** o membro e o motivo "Senha atual incorreta";<br>(e) **Troca de senha bloqueada por excesso de tentativas:** um registro quando o bloqueio começa, com a duração. As tentativas recusadas durante o bloqueio não geram um registro cada;<br>(f) **Troca de senha exigida:** quando a marca é posta no login (motivo "Senha fora das regras") ou na publicação (motivo "Senha inicial"). A marca da redefinição e do cadastro não gera um registro à parte;<br>(g) **No login (E1.04):** o motivo de falha "Senha temporária vencida" (RN-05).<br><br>Detalhes:<br>- Nunca vão para a Auditoria nem para os logs: a senha atual, a nova, a temporária, a inicial digitada, qualquer hash delas e a origem.<br>- A redefinição e a troca só acontecem junto com o registro delas. Se o registro falhar, nada muda, e a tela mostra o erro de conexão.<br>- Se o registro de uma recusa, falha ou bloqueio falhar, a resposta ao usuário não muda.<br>- Só quem tem "Visualizar Auditoria" vê esses registros, como hoje. | 6.3 do plano (Controles: "nada de senha, hash ou dado pessoal em log"); E1.04 (RN-15 e P-LOG-12); a `change-member-password` atual já registra "Senha alterada" (`password_changed`); eventos, motivos e o "junto": definida pelo spec (P-SEN-17) |

### Critérios de aceite
Convenções:
- "Pela API" é qualquer chamada feita fora da tela, à função de redefinição, à de troca ou ao Auth, com a sessão de quem chama.
- "Erro de permissão" quer dizer que a chamada é recusada sem gravar nada.
- "Mensagem única" é a do login do E1.04: "Usuário ou senha inválidos. Confira os dados e tente de novo.".
- "Entra" quer dizer que recebe a sessão pela `sign-in` (E1.04).
- "Sessão encerrada" quer dizer que, na próxima ação naquele aparelho, a tela leva ao login com "Sua sessão terminou. Entre de novo para continuar.", e que a API não aceita mais leituras nem gravações com aquela sessão.
- As mensagens estão em [Textos de tela](#textos-de-tela).
- Cada critério parte da massa original.

#### Massa de exemplo
A massa do [E2.02](e2-02-perfis-escopo.md#massa-de-exemplo), com as funções de lá, mais:
- **Olga:** discípula de Paula, com a função Administrador (a segunda administradora, 6.6).
- **Nina:** discípula de André, com a função Membro, excluída (conta suspensa, E2.01).
- **Lauro:** discípulo de André, com a função Membro, sem conta de acesso.
- **Dados de Caio** (fictícios): e-mail `caio.lima@exemplo.com`, celular (51) 98888-7777, CPF 529.982.247-25, nascimento 15/03/1990, senha `Caminho2024`.
- Depois da migration deste passo, a Líder tem "Redefinir Senha de Membros".

Com isso:
- Olga fica visível para quem vê o ministério de Pedro e Paula (Pedro, Paula, André, Caio, Carla, Fábio e Gabriel), e também para Samuel, Magda e Rita;
- Lauro fica visível para essas mesmas pessoas e também para Beatriz, cônjuge de André;
- Nina não aparece para ninguém.

O sábado 28/11/2026 e o domingo 29/11/2026 são usados nos casos de virada de semana, no horário de Brasília.

#### Critérios por regra
- **RN-01**
  - Dado um banco com as três funções semeadas
  - Quando a migration deste passo roda
  - Então a Líder passa a ter "Redefinir Senha de Membros", a Administrador continua com todas as permissões, e a Membro não tem essa permissão.
  - Dada a tela de Funções
  - Então a permissão aparece como "Redefinir Senha de Membros", com a dica dos Textos de tela.
  - Dada uma função criada na tela, com "Gerenciar Funções" e sem "Redefinir Senha de Membros"
  - Quando quem tem essa função tenta redefinir uma senha pela API
  - Então recebe "Você não tem permissão para redefinir senhas.", e nada muda.
  - Dado Caio (Membro)
  - Quando ele abre o cadastro de Fábio
  - Então não vê "Redefinir senha".
  - Quando ele chama a redefinição de Fábio pela API
  - Então recebe "Você não tem permissão para redefinir senhas.", nada muda, e a Auditoria registra a recusa com o motivo "Sem permissão".
  - Dado Hugo (sem função)
  - Quando ele chama a redefinição de qualquer membro pela API
  - Então recebe a mesma recusa.
  - Dado André (Líder), na lista de Membros
  - Quando ele abre as ações da linha (ou do card, no celular) de Caio
  - Então vê "Redefinir senha", que abre a mesma confirmação do cadastro.
  - E na linha dele mesmo a ação não aparece.
  - Dada Carla com a função "Apoio", criada na tela com as permissões da Membro mais "Redefinir Senha de Membros", sem "Editar Membro"
  - Quando ela usa "Redefinir senha" na linha de Caio, na lista de Membros
  - Então a redefinição é aceita, porque Caio está visível e a função Apoio cobre a Membro.
- **RN-02**
  - Dado André (Líder)
  - Quando ele redefine a senha de Caio, a de Fábio (inativo) e a de Beatriz (cônjuge, discípula de outro ministério)
  - Então as três são aceitas.
  - Quando André redefine a senha de Pedro (o G12 dele, Líder)
  - Então é aceita, porque Pedro está visível e André cobre a função Líder.
  - Quando André tenta redefinir a senha de Olga (Administrador), pela tela ou pela API
  - Então recebe "Você não tem permissão para redefinir a senha deste membro.", e nada muda.
  - Dado Diego (Líder, outro ministério)
  - Quando ele tenta redefinir a senha de Rita (Administrador, visível para ele)
  - Então recebe "Você não tem permissão para redefinir a senha deste membro.".
  - Quando Diego tenta redefinir a senha de Caio pela API
  - Então recebe "Este cadastro não existe ou já foi excluído.", e a Auditoria registra o motivo "Fora do que a pessoa vê".
  - Dada Rita (Administrador)
  - Quando ela redefine a senha de Olga (Administrador)
  - Então é aceita.
  - Dado Samuel (pastor), cuja senha é redefinida
  - Quando Pedro tenta, pela API
  - Então recebe "Este cadastro não existe ou já foi excluído.", porque Pedro não vê os pastores.
  - Quando Magda (cônjuge dele, Líder) redefine
  - Então é aceita.
  - Dada Ester (sem liderança)
  - Quando Samuel tenta redefinir a senha dela
  - Então recebe "Este cadastro não existe ou já foi excluído.".
  - Quando Rita redefine
  - Então é aceita.
  - Dada Nina (excluída)
  - Quando André ou Rita tenta redefinir a senha dela, pela API
  - Então os dois recebem "Este cadastro não existe ou já foi excluído.", a conta suspensa de Nina não muda, e a Auditoria registra o motivo "Cadastro excluído".
  - Quando Rita restaura Nina (E2.01)
  - Então Nina entra com a mesma senha de antes.
  - Dado Lauro (sem conta de acesso)
  - Quando André tenta redefinir a senha dele
  - Então recebe "Este membro não tem acesso ao sistema.", e nada é criado.
  - Dada Rita
  - Quando ela tenta redefinir a própria senha, pela API
  - Então recebe o texto `Para trocar a sua senha, use "Alterar minha senha".`, nada muda, e a Auditoria registra o motivo "Própria senha".
  - Dado Caio (sem a permissão)
  - Quando ele tenta redefinir a senha de Nina pela API
  - Então recebe "Você não tem permissão para redefinir senhas.", porque a permissão é conferida primeiro.
- **RN-03**
  - Quando André redefine a senha de Caio
  - Então a tela mostra uma senha de 8 caracteres, só com letras minúsculas e números, sem 0, 1, i, l e o, com "Válida até" a data e a hora no horário de Brasília e o botão para copiar.
  - Quando André toca em "Copiar senha" ou em "Compartilhar senha"
  - Então o texto copiado ou compartilhado é exatamente a senha de 8 caracteres, sem nenhum outro texto.
  - Quando Caio cola no campo de senha do login tudo o que recebeu e entra com o celular
  - Então entra, sem gastar tentativa.
  - Quando André toca em "Concluir" sem ter copiado a senha
  - Então a tela fecha sem pedir confirmação.
  - Quando André fecha a tela
  - Então nem ele, nem Rita, nem ninguém consegue ver a senha de novo, pela tela ou pela API.
  - Quando André redefine de novo, porque não passou a senha a Caio
  - Então a senha anterior deixa de funcionar, e a nova aparece (RN-04).
  - Dada a redefinição
  - Então nenhum e-mail, SMS ou mensagem é enviado a Caio pelo sistema.
  - Quando Caio entra com o celular, o CPF ou o e-mail e a senha temporária
  - Então entra nos três casos e vai para a troca obrigatória.
  - Dadas 1.000 redefinições feitas num ambiente de teste
  - Então todas as senhas temporárias atendem à política (RN-13) e nenhuma se repete.
- **RN-04**
  - Dado Caio, com a senha `Caminho2024`
  - Quando André redefine a senha dele
  - Então `Caminho2024` deixa de funcionar na hora (mensagem única), e a senha temporária funciona.
  - E o cadastro, a função e a situação de Caio continuam iguais.
  - Dado Caio com a identificação do celular bloqueada por tentativas no login (E1.04), com 10 minutos restantes
  - Quando André redefine a senha dele
  - Então o bloqueio continua: Caio, pelo celular, recebe a mensagem de bloqueio até o fim dos 10 minutos e, depois, entra com a senha temporária.
  - Quando André redefine a senha de Caio e, logo depois, Pedro também
  - Então a senha temporária gerada para André não funciona mais, a de Pedro funciona, e a Auditoria tem as duas redefinições.
  - Dado, a partir do E3.02, Caio com a senha antiga do legado ainda não usada
  - Quando André redefine a senha dele
  - Então a senha antiga do legado deixa de funcionar.
- **RN-05**
  - Dada a redefinição da senha de Caio no sábado 28/11/2026 às 23:50
  - Então a tela mostra "Válida até 05/12/2026 às 23:50".
  - Quando Caio entra no domingo 29/11/2026 às 00:05 com a senha temporária
  - Então entra, porque a virada da semana não muda a validade, e vai para a troca obrigatória.
  - Quando Caio sai sem trocar e entra de novo em 05/12/2026 às 23:49
  - Então entra e vai de novo para a troca obrigatória.
  - Quando Caio tenta em 05/12/2026 às 23:51 com a senha temporária
  - Então recebe a mensagem única, a tentativa conta para os limites do E1.04, e a Auditoria registra "Falha no login" com o motivo "Senha temporária vencida".
  - Quando Caio tenta, depois do prazo, com outra senha qualquer
  - Então o motivo é "Senha incorreta".
- **RN-06**
  - Dado Pedro, com 20 redefinições aceitas nos últimos 60 minutos, a mais antiga feita há 52 minutos
  - Quando ele tenta a 21ª
  - Então recebe "Você redefiniu muitas senhas na última hora. Aguarde 8 minutos e tente de novo.", nada muda, e a Auditoria registra a recusa com o motivo "Limite de redefinições".
  - Dado Pedro, com 19 redefinições aceitas e 5 recusadas na última hora
  - Quando ele faz mais uma
  - Então ela é aceita, porque as recusas não contam.
  - Dadas 25 redefinições enviadas ao mesmo tempo por Pedro, sem nenhuma anterior na última hora
  - Então no máximo 20 são aceitas.
- **RN-07**
  - Dado Pedro, cadastrando Mateus sem digitar senha
  - Quando o cadastro é salvo
  - Então a conta de Mateus nasce com a senha `123456` e com a marca de troca obrigatória.
  - Quando Mateus entra com `123456`, 60 dias depois
  - Então entra, porque a senha inicial não vence, e vai para a troca obrigatória.
  - Quando Pedro digita a senha inicial `abc12`
  - Então recebe "A senha precisa ter pelo menos 8 caracteres.", e nada é gravado.
  - Quando Pedro digita a senha inicial `Oliveira#7`
  - Então o cadastro é salvo, e Mateus, no primeiro acesso, vai para a troca obrigatória.
  - Quando Pedro digita `123456`
  - Então o cadastro é salvo, como se o campo estivesse em branco.
  - Dado o cadastro novo de Mateus, com o CPF 529.982.247-25 digitado no formulário
  - Quando Pedro digita a senha inicial `mat52998224725`
  - Então recebe "A senha não pode conter o CPF, o celular ou a data de nascimento do membro, nem ser o e-mail do cadastro.", e nada é gravado.
  - Dado o cadastro novo
  - Então o campo "Senha inicial (opcional)" fica na seção Acesso, com "Mostrar senha", e não há "Confirmar senha".
- **RN-08**
  - Dada Vera, cadastrada antes deste passo com a senha `123456`, com a sessão aberta
  - Quando este passo é publicado
  - Então a próxima ação de Vera a leva para a troca obrigatória, e a Auditoria registra "Troca de senha exigida" com o motivo "Senha inicial".
  - Dado Gabriel, com a senha `abc123`, gravada antes deste passo
  - Quando ele entra com `abc123`
  - Então entra, vai para a troca obrigatória, e a Auditoria registra "Troca de senha exigida" com o motivo "Senha fora das regras".
  - Quando Gabriel sai sem trocar e entra de novo
  - Então volta para a troca obrigatória, e não há um novo registro de troca exigida.
  - Dado Caio, com a senha `Caminho2024`, que atende à política
  - Quando ele entra
  - Então vai direto para a tela inicial.
  - Dado Fábio (inativo), com a marca
  - Quando ele entra
  - Então vai para a troca obrigatória, como qualquer membro.
  - Dado Caio, com a marca, excluído e depois restaurado (E2.01)
  - Quando ele entra com a mesma senha
  - Então vai para a troca obrigatória.
  - Dada uma conta criada pela carga com uma senha aleatória (6.2)
  - Então ela não tem a marca.
- **RN-09**
  - Dado Caio, com a marca, conectado
  - Quando ele abre `/members` ou `/cells` pelo endereço
  - Então vê a tela de troca obrigatória.
  - Quando ele lê membros, células, relatórios ou o Dashboard pela API
  - Então recebe erro de permissão, ou uma resposta vazia, e nenhum dado.
  - Quando ele tenta gravar um relatório pela API
  - Então recebe erro de permissão, e nada é gravado.
  - Quando ele toca em "Sair"
  - Então sai, e a Auditoria registra o logout, como hoje.
  - Dado André (Líder), com a marca
  - Quando ele tenta redefinir a senha de Caio pela API
  - Então recebe erro de permissão.
  - Dada Rita (Administrador), com a marca
  - Então também só vê a troca obrigatória.
- **RN-10**
  - Dado Caio, com a marca, que entrou com a senha temporária
  - Quando ele digita `Abacate77` como nova senha e `Abacate78` na confirmação
  - Então recebe "As senhas não conferem.", e nada é gravado.
  - Quando ele digita a própria senha temporária como nova senha
  - Então recebe "A nova senha precisa ser diferente da atual.".
  - Quando ele digita `Abacate77` nos dois campos
  - Então a senha muda, a marca sai, ele segue para a tela inicial, e a Auditoria registra "Senha alterada", do tipo "Obrigatória".
  - E a senha temporária deixa de funcionar.
  - Dado Caio, sem a marca, conectado
  - Quando ele chama pela API a troca sem informar a senha atual
  - Então recebe erro de permissão, e a senha não muda.
- **RN-11**
  - Dado Hugo (sem função)
  - Quando ele abre "Alterar minha senha" no menu e troca a senha, informando a atual
  - Então a troca é aceita.
  - Dados Fábio (inativo), Samuel (pastor) e Ester (sem liderança)
  - Quando cada um troca a própria senha, informando a atual
  - Então as trocas são aceitas.
  - Dado Caio, conectado no celular e no computador
  - Quando ele troca a senha no celular, informando a atual
  - Então a sessão do celular continua, a do computador é encerrada, e a Auditoria registra "Senha alterada", do tipo "Voluntária".
  - Quando Caio informa a senha atual errada
  - Então recebe "A senha atual não confere.", com "Se não lembra a senha atual, fale com o seu líder.", nada muda, e a Auditoria registra "Falha na troca de senha", com o motivo "Senha atual incorreta".
  - Dado Caio em "Editar meus dados" e Hugo em "Ver meus dados"
  - Quando cada um toca em "Alterar minha senha", na seção Acesso do próprio cadastro
  - Então abre o mesmo diálogo do menu, e "Redefinir senha" não aparece.
  - Quando Caio informa a senha atual certa e a nova `12345678`
  - Então recebe "Esta senha é fácil de adivinhar. Escolha outra.", nada muda, e a tentativa não conta para o limite.
  - Dado Caio, com a marca, que usa "Alterar minha senha" pela API, informando a senha atual
  - Quando a troca é concluída
  - Então a marca também sai.
- **RN-12**
  - Dado Caio, conectado
  - Quando ele erra a senha atual 4 vezes e erra de novo na 5ª, dentro de 15 minutos
  - Então a 5ª recebe "Muitas tentativas sem sucesso. Aguarde 15 minutos e tente de novo.".
  - Quando ele tenta de novo com a senha atual certa, 5 minutos depois
  - Então recebe a mensagem de bloqueio com "Aguarde 10 minutos", e a senha não muda.
  - E a sessão dele continua funcionando nas outras telas.
  - Quando, durante o bloqueio da troca, Caio entra em outro aparelho pelo celular e a senha certa
  - Então entra, porque o bloqueio da troca não bloqueia o login.
  - Dados 2 erros da senha atual no sábado 28/11/2026 às 23:55 e mais 3 no domingo 29/11/2026 às 00:05
  - Então a 5ª tentativa já recebe a mensagem de bloqueio, porque a virada da semana não zera a contagem.
  - Dadas 15 falhas de login e 5 erros da senha atual, vindos da mesma origem, em 10 minutos
  - Então a origem fica bloqueada (RN-11 do E1.04), e a próxima troca voluntária feita dessa origem recebe a mensagem de bloqueio.
  - Dadas 20 trocas enviadas ao mesmo tempo, com a senha atual errada
  - Então no máximo 5 têm a senha conferida.
- **RN-13**
  - Dado Caio, na troca voluntária, com a senha atual certa
  - Quando ele tenta cada uma destas senhas novas
  - Então recebe a mensagem indicada, e nada muda:
    - `Abc1234` (7 caracteres): "A senha precisa ter pelo menos 8 caracteres.";
    - uma frase de 70 caracteres com 3 letras acentuadas (73 bytes): "A senha é longa demais.";
    - `11111111`, `12345678`, `87654321`, `abcdefgh`, `password1`, `Senha123`, `igreja@2024` e `MCI12rs2025`: "Esta senha é fácil de adivinhar. Escolha outra.";
    - `52998224725`, `cpf529.982.247-25`, `zap98888-7777`, `caio15/03/1990` e `CAIO.LIMA@exemplo.com`: "A senha não pode conter o seu CPF, o seu celular ou a sua data de nascimento, nem ser o seu e-mail.";
    - `Caminho2024`, a atual: "A nova senha precisa ser diferente da atual.".
  - Quando ele tenta `Abacate7`, ` Fé 2024` (com espaço no início e acento) ou `luz do mundo`
  - Então a troca é aceita, e ele entra depois com a senha exatamente como digitou.
  - Dada Beatriz, sem CPF nem data de nascimento no cadastro
  - Quando ela escolhe `47391826`
  - Então a troca é aceita: só números é permitido, não é sequência simples, e não há CPF nem data para conferir.
  - Dado o login de alguém com `12345678`
  - Então ele entra (a política não recusa o login) e vai para a troca obrigatória (RN-08 b).
- **RN-14**
  - Dado Caio, conectado
  - Quando alguém, com a sessão de Caio, tenta trocar a senha pela API direto no Auth, sem passar pelas funções deste spec
  - Então a troca é recusada, a senha não muda, e nenhuma regra deste spec é contornada.
  - Dado um administrador com "Redefinir Senha de Membros"
  - Quando ele tenta, pela API, gravar uma senha escolhida por ele para outro membro
  - Então não consegue: a redefinição só gera a senha temporária (RN-03).
- **RN-15**
  - Dada a tela de login
  - Então ela mostra "Esqueceu a senha? Fale com o seu líder.", sem link e sem campo.
  - Quando alguém pede a recuperação padrão do Auth pela API, com o e-mail de Caio
  - Então nada é enviado, e a senha de Caio não muda.
- **RN-16**
  - Dado Caio, conectado no celular e no computador
  - Quando André redefine a senha dele
  - Então as duas sessões são encerradas, e a próxima leitura de Caio pela API, com qualquer das duas, não devolve dados.
  - E as sessões de André continuam.
  - Dado Caio com a marca, conectado em dois aparelhos com a senha temporária
  - Quando ele conclui a troca obrigatória num deles
  - Então a sessão desse aparelho continua, e a do outro é encerrada.
  - Dada Vera, marcada na publicação (RN-08 c), com a sessão aberta
  - Então a sessão não é encerrada: ela continua, só para a troca obrigatória.
- **RN-17**
  - Quando André redefine a senha de Caio
  - Então a Auditoria tem "Senha redefinida", com André como autor, o cadastro de Caio e a validade.
  - Quando Caio conclui a troca obrigatória
  - Então a Auditoria tem "Senha alterada", com Caio como autor e o tipo "Obrigatória".
  - Quando Caio erra a senha atual 5 vezes na troca voluntária e tenta mais 3 vezes durante o bloqueio
  - Então a Auditoria tem 5 registros "Falha na troca de senha" e um único "Troca de senha bloqueada por excesso de tentativas", com a duração de 15 minutos.
  - Dado qualquer registro deste spec
  - Então ele não contém a senha atual, a nova, a temporária, a inicial digitada, hash nem origem.
  - Dado Caio, sem "Visualizar Auditoria"
  - Então ele não vê esses registros, nem pela API.
  - Dada uma falha forçada na gravação da Auditoria
  - Quando André redefine a senha de Caio
  - Então a senha de Caio não muda, nenhuma senha temporária é mostrada, as sessões de Caio continuam, e a tela mostra "Não foi possível redefinir a senha. Verifique a conexão e tente de novo.".

### Textos de tela
Vocabulário de referência. O `ux-designer` pode ajustar o tom, mas não o sentido nem os termos. Os textos do login, de bloqueio e de sessão encerrada são os do E1.04 e do E2.01 e não mudam.

- **Termos:** Senha, Senha temporária, Redefinir senha, Alterar minha senha, Nova senha, Senha atual, Membro, Líder, Administrador.
- **Evitar:** "resetar", "reset", "password", "usuário" no lugar de membro, "bloqueada" ou "suspensa" para a conta (o E1.04 já evita), e qualquer texto que diga a quem não audita se um cadastro existe fora do que a pessoa vê.

| Situação | Texto |
|---|---|
| Permissão, na tela de Funções (RN-01) | Redefinir Senha de Membros · dica: "Gera uma senha temporária para os membros que a pessoa vê, só de funções com permissões que ela também tem. O membro cria uma nova senha no próximo acesso." |
| Ação no cadastro e na lista de Membros (RN-01) | Redefinir senha · Redefinindo… · No cadastro, depois: Senha redefinida às {hh:mm}. Não é preciso salvar o cadastro. |
| Confirmação da redefinição | Título, com o nome completo: Redefinir a senha de {Nome}? · Tópicos, com o primeiro nome: A senha atual de {Primeiro nome} deixa de funcionar agora. / Se {Primeiro nome} estiver conectado (ou conectada, conforme o cadastro), terá que entrar de novo. / Você vai receber uma senha temporária, válida por 7 dias, para passar a {Primeiro nome}. / No próximo acesso, {Primeiro nome} cria uma nova senha. · Botões: Redefinir senha · Cancelar |
| Senha temporária (RN-03) | Título: Senha temporária de {Nome} · {senha} · Só letras minúsculas e números. · Válida até {dd/mm/aaaa} às {hh:mm}. · Passe esta senha a {Primeiro nome} pessoalmente ou por mensagem direta. **Ela não será mostrada de novo.** · {Primeiro nome} entra com o CPF, o celular ou o e-mail do cadastro e esta senha, e cria uma nova senha em seguida. · Botões: Copiar senha · Compartilhar senha · Concluir · Depois de copiar: Senha copiada. · Cópia que falhou: Não foi possível copiar. Selecione a senha para copiá-la. |
| O que é copiado ou compartilhado (RN-03) | Só a senha: os 8 caracteres, sem nenhum outro texto. |
| Recusas da redefinição (RN-02, RN-06) | Título: Não foi possível redefinir a senha · Você não tem permissão para redefinir senhas. · Você redefiniu muitas senhas na última hora. Aguarde {N} minutos e tente de novo. ("1 minuto" no singular) · Este cadastro não existe ou já foi excluído. (texto do E2.01) · Para trocar a sua senha, use "Alterar minha senha". · Você não tem permissão para redefinir a senha deste membro. · Este membro não tem acesso ao sistema. |
| Falha de conexão na redefinição | Não foi possível redefinir a senha. Verifique a conexão e tente de novo. |
| Menu da pessoa e próprio cadastro (RN-11) | Alterar minha senha |
| Troca voluntária | Título: Alterar minha senha · Senha atual · Nova senha · Confirmar nova senha · Botões: Salvar nova senha · Salvando… · Cancelar · Sucesso: Senha alterada. Nos outros aparelhos, será preciso entrar de novo. |
| Troca obrigatória (RN-10) | Título: Crie uma nova senha · Para continuar, crie uma nova senha. Ela substitui a senha que você usou para entrar. · Nova senha · Confirmar nova senha · Botões: Salvar nova senha · Salvando… · Sair · Sucesso: Senha alterada. Use a nova senha da próxima vez que entrar. |
| Campos vazios (nas trocas) | Informe a senha atual. · Informe a nova senha. · Confirme a nova senha. |
| Regras da senha (dica, nas duas trocas) | Use pelo menos 8 caracteres. Evite sequências (12345678), repetições (11111111) e senhas comuns, e não use o seu CPF, celular ou data de nascimento. |
| Erros da senha nova (RN-13) | A senha precisa ter pelo menos 8 caracteres. · A senha é longa demais. · Esta senha é fácil de adivinhar. Escolha outra. · A senha não pode conter o seu CPF, o seu celular ou a sua data de nascimento, nem ser o seu e-mail. · A nova senha precisa ser diferente da atual. · As senhas não conferem. |
| Senha atual errada (RN-11) | A senha atual não confere. · A partir do primeiro erro: Se não lembra a senha atual, fale com o seu líder. |
| Bloqueio da troca (RN-12) | Muitas tentativas sem sucesso. Aguarde {N} minutos e tente de novo. ("1 minuto" no singular) |
| Falha de conexão na troca | Não foi possível salvar a nova senha. Verifique a conexão e tente de novo. |
| Login (RN-15) | Esqueceu a senha? Fale com o seu líder. |
| Cadastro novo, campo "Senha inicial (opcional)" na seção Acesso (RN-07) | dica: Se ficar em branco, a senha inicial é 123456. No primeiro acesso, o membro cria a própria senha. · Regra: Use pelo menos 8 caracteres. Evite sequências (12345678), repetições (11111111) e senhas comuns, e não use o CPF, o celular ou a data de nascimento do membro. · Erro dos dados pessoais: A senha não pode conter o CPF, o celular ou a data de nascimento do membro, nem ser o e-mail do cadastro. · Os demais erros são os da senha nova, menos "diferente da atual" e "não conferem". |
| Sessão encerrada (RN-16) | Sua sessão terminou. Entre de novo para continuar. (texto do E2.01) |
| Auditoria: ação | Senha redefinida · Senha redefinida (recusa) · Senha alterada · Senha alterada (falha) · Senha alterada (bloqueio) · Troca de senha exigida |
| Auditoria: descrição | Senha redefinida · Redefinição de senha recusada · Senha alterada · Falha na troca de senha · Troca de senha bloqueada por excesso de tentativas · Troca de senha exigida |
| Auditoria: campos | Cadastro · Motivo · Tipo de troca (Obrigatória · Voluntária) · Validade · Duração. A segunda linha da descrição e os formatos da validade e da duração são os de Experiência (UX) > Textos. |
| Auditoria: motivos | Recusa: Sem permissão · Limite de redefinições · Fora do que a pessoa vê · Cadastro excluído · Própria senha · Função não coberta · Sem conta de acesso. Falha: Senha atual incorreta. Troca exigida: Senha fora das regras · Senha inicial. Login (E1.04): Senha temporária vencida |

### Fora de escopo
Cada item indica o passo que cuida dele.
- **Recuperação de senha por e-mail** ("Esqueci minha senha" com link): E1.07, que ainda não tem credenciais de SMTP. Pelo DT-01 do E1.04, ela precisa de uma função própria, porque a recuperação padrão do Auth fica desligada. Ver Impactos.
- **Senha legada:** a tabela das credenciais (E3.01), a conferência do MD5 e o uso, na primeira entrada, da política e da marca deste spec (E3.02). Os testes do login legado ficam no E3.03.
- **Comunicação aos usuários** (6.7): E3.05. Ver Impactos.
- **Criar a conta de acesso** de quem não tem (por exemplo, o membro migrado sem e-mail e sem celular, ou o restaurado sem conta): E4.08. Neste passo, a redefinição recusa quem não tem conta (RN-02 e).
- **Desbloqueio manual** do login, ou a redefinição terminando o bloqueio por tentativas: não, como decidiu o E1.04 (P-LOG-07).
- **Envio da senha temporária pelo sistema**, por e-mail, SMS ou WhatsApp: sem passo no plano.
- **Mostrar no cadastro se o membro ainda precisa trocar a senha:** sem passo no plano.
- Validade periódica de senha, histórico de senhas (não repetir as últimas), medidor de força, verificação em duas etapas e "sair de todos os aparelhos" sem trocar a senha: sem passo no plano.
- **A senha inicial `123456`** (D11): continua como está, sem prazo. Ver a observação em Perguntas em aberto.
- **Troca de senha pela operação** (painel do Supabase, scripts com a chave secreta): não é caminho de uso (RN-14).
- **Troca do e-mail da conta de acesso:** este passo não mexe no e-mail da conta.
- **Consolidação:** o consolidado não tem conta de acesso até virar membro (E1.04, Impactos), então não é alvo de redefinição. O spec da Consolidação confirma isso quando a flag existir.

### Impactos em outros passos
Pontos de negócio que outros passos precisam respeitar. O `architect` decide como.
- **E1.04 (`sign-in`):**
  - a `sign-in` passa a conferir a política (RN-13) com a senha digitada, sem gravá-la, e põe a marca quando ela não é cumprida (RN-08 b);
  - a sessão que ela devolve leva a marca (Dependências da Solução técnica do E1.04: "a troca obrigatória lê `app_metadata.must_change_password` da sessão vinda da `sign-in`");
  - a senha temporária vencida entra como uma falha da RN-07 de lá, com o motivo novo "Senha temporária vencida" na RN-15 de lá, sem mudar a resposta nem o tempo;
  - os erros da senha atual da troca voluntária contam no limite por origem (RN-11 de lá);
  - a tela de login (T1 de lá) ganha o texto da RN-15.
- **E2.01:** a recusa de alvo excluído (RN-07 de lá) entra aqui. A restauração devolve a mesma senha e a mesma marca (RN-08). O aviso de sessão encerrada é o de lá.
- **E2.02:**
  - a Líder passa a ter "Redefinir Senha de Membros": a tabela "Funções semeadas" (RN-16 de lá) e a P-PER-08 mudam no aceite;
  - o rótulo novo entra na tabela "Rótulos e descrições" (RN-22 de lá), e a dica, nas dicas das permissões da UX de lá;
  - a redefinição aplica a RN-09 e a RN-18 de lá ao alvo, como a fronteira de lá previa.
- **E3.02 (senha legada):**
  - a "política" da 6.3 é a RN-13 deste spec;
  - quem entra com uma senha antiga fora da política e não conclui a troca obrigatória não pode perder o acesso: na próxima entrada com a mesma senha antiga, volta à troca obrigatória. Isso vale para qualquer forma de gravar a senha na primeira entrada;
  - a redefinição apaga a credencial legada pendente (RN-04);
  - a marca posta na primeira entrada gera "Troca de senha exigida" na Auditoria, com o motivo "Senha fora das regras".
- **E3.05 e 6.7 (comunicação):** dizer que, se a senha antiga for curta ou simples demais, o sistema pede uma nova no primeiro acesso, com as regras da RN-13 em linguagem simples, e que quem esqueceu a senha fala com o líder, que gera uma senha temporária válida por 7 dias.
- **E1.07 (recuperação por e-mail):**
  - é uma troca feita pelo próprio membro: segue a política (RN-13), tira a marca, encerra as outras sessões (RN-16) e é registrada (RN-17);
  - não vale para e-mail fictício nem para membro excluído (RN-14 do E2.01).
- **E4.08:** as contas criadas pela carga, com senha aleatória, não recebem a marca (RN-08). Os membros sem senha no legado (5.4) entram pela redefinição.
- **E5 (ensaios):** incluir a redefinição por um líder e a troca obrigatória de um membro só com celular.
- **Deploy:**
  - a função de redefinição entra na lista de publicação do workflow "Deploy: banco". O `CLAUDE.md` diz hoje que a `change-member-password` fica de fora até este passo;
  - a publicação é feita fora das noites de célula, quando os relatórios são lançados. Quem estiver com a sessão aberta e a senha `123456` é levado à troca e perde o que estava digitando (RN-08 c, P-SEN-24).
- **Aceite (PO):**
  - no `docs/migracao.md`:
    - na 3.1, marcar AUT-06 como ✅;
    - na 6.4, trocar "usa o 'Esqueci minha senha' padrão do Supabase Auth" pela recuperação própria do E1.07, e registrar a política e a validade da senha temporária;
    - na 6.5, a Líder com "Redefinir Senha de Membros";
    - na seção 2, marcar "`change-member-password`: checar o escopo e o perfil do alvo" como feito;
  - no `CLAUDE.md`: a linha "Troca de senha de outro membro" da matriz, a descrição da `change-member-password` em "Edge Functions", o item dela em "Problemas conhecidos", o botão "Alterar senha" em "Front" e a nota de deploy.

### Pontos para o `architect`
Não são dúvidas de negócio. São pontos em que a regra depende de uma escolha técnica. Se algum não tiver caminho viável, a regra volta ao PO antes da implementação.
1. **Ordem.** O passo depende do E1.04 (a marca no login, a política conferida com a senha digitada, a validade da senha temporária e o limite por origem), do E2.01 (alvo excluído e conta suspensa) e do E2.02 (escopo, `viewer_covers_role` e a Líder). A nota 12 da Solução técnica do E2.02 já prevê reescrever a `change-member-password` com a sessão de quem chama.
2. **Caminho único da troca (RN-14).** Com o provedor de e-mail desligado (DT-01 do E1.04), o `PUT /user` continua aceitando a troca de senha com a sessão do próprio usuário, sem senha atual, sem a política deste spec, sem os limites e sem a Auditoria. Se não houver como recusar, o mínimo é a RN-08 b pegar a senha fraca no login seguinte, e a regra volta ao PO.
3. **Política do próprio Auth × D11.** A `123456` precisa continuar valendo como senha inicial (RN-07), então o tamanho mínimo configurado no Auth não pode simplesmente subir para 8. A política (RN-13) precisa de um ponto único, usado pela tela (para orientar) e pelo servidor (que decide), inclusive na `sign-in`.
4. **"Na hora" (RN-09 e RN-16).** A marca e o encerramento das sessões precisam valer na próxima ação, inclusive para o token de acesso já emitido, que hoje continua válido até expirar. O E2.01 resolveu o caso do excluído pelas funções de identidade do banco; o mesmo ponto único pode servir aqui.
5. **Tudo ou nada (RN-17).** A redefinição e a troca só acontecem junto com o registro na Auditoria. A senha fica no Auth, e a Auditoria fica no banco, então as duas gravações precisam ser coordenadas.
6. **Senha temporária (RN-03 e RN-05).** Ela é gerada no servidor, com aleatoriedade segura. Ela é devolvida uma vez só e nunca vai para logs. A validade precisa ficar onde a `sign-in` a lê, sem mudar o tempo igual da RN-07 do E1.04.
7. **Marca na publicação (RN-08 c).** É preciso descobrir quais contas ainda têm a senha `123456`, sem que a senha de ninguém fique exposta.
8. **Contagens (RN-06 e RN-12).** O limite de redefinições por pessoa e o limite da senha atual por conta, ambos atômicos com chamadas simultâneas. O limite da senha atual também alimenta o contador por origem do E1.04.
9. **Função de redefinição.** Ela não aceita senha escolhida por quem chama (RN-14) e confere tudo com a sessão de quem chama. O nome atual (`change-member-password`) pode mudar, desde que a lista de publicação acompanhe.
10. **DT-01 do E1.04 em revisão.** Se o usuário mudar a DT-01 no PR do E1.04 e o provedor de e-mail voltar a ficar ligado, a RN-14 e a RN-15 deste spec precisam ser revistas.

### Perguntas em aberto
Nenhuma. Os pontos que as fontes não respondiam viraram padrões, listados em [Padrões definidos por este spec](#padrões-definidos-por-este-spec-revisar-no-pr), para o usuário revisar no PR. Os que mais mudam o resultado são:
- **P-SEN-13:** a política de senha, sobretudo o mínimo de 8 caracteres (as senhas antigas mais curtas vão pedir troca no primeiro acesso) e a proibição de usar o CPF, o celular e a data de nascimento.
- **P-SEN-03 e P-SEN-05:** a senha temporária é gerada pelo sistema, e não escolhida pelo líder, e vale por 7 dias.
- **P-SEN-09:** com a marca, a pessoa não faz mais nada até trocar a senha, nem pela API.
- **P-SEN-11 e P-SEN-12:** a troca voluntária pede a senha atual, com limite de 5 erros.
- **P-SEN-06:** o limite de 20 redefinições por hora.
- **P-SEN-04:** a redefinição não termina o bloqueio por tentativas do login. A pessoa pode precisar esperar até 15 minutos.
- **RN-02:** um líder redefine a senha do próprio G12 ou do líder dele quando os vê e cobre a função deles, como no legado.
- **P-SEN-18:** copiar e compartilhar levam só a senha, sem a mensagem pronta que a UX propôs.
- **P-SEN-21:** a senha inicial não tem "Confirmar senha" (o legado tinha); um erro de digitação se resolve com uma redefinição.

**Observação para o usuário (não muda a D11):** a troca obrigatória fecha a senha `123456` a partir do primeiro acesso, mas não antes dele. Quem conhece o CPF ou o celular de um membro que ainda não entrou consegue entrar com `123456` antes dele e criar a senha no lugar dele. Para fechar essa janela, a senha inicial teria de vencer, como a temporária (RN-05). Isso muda a D11, então fica como está até o usuário decidir.

## Experiência (UX)
_Seção do `ux-designer`. Escrita em 2026-11-23 a partir da seção Negócio (RN-01 a RN-17, P-SEN-01 a P-SEN-17, a massa de exemplo e os Textos de tela), das telas já desenhadas no [E1.04](e1-04-sign-in.md) (T1 Login e T2 Auditoria) e no [E2.02](e2-02-perfis-escopo.md) (T1 Menu, T3 Funções e T6 Cadastro de membro), e do código da `origin/main` do `mci-connect` (`bef0877`: `MemberForm.tsx`, `AppSidebar.tsx`, `Login.tsx`, `Events.tsx`, `Roles.tsx` e `App.tsx`). Como este passo só é implementado depois do E1.04, do E2.01 e do E2.02, o desenho parte das telas daqueles specs, e não do código de hoje. Segue os padrões P1 a P14 (Escolas, E2.01 e E2.02), e a numeração continua em P15. Nenhuma regra de negócio foi criada aqui. Onde a tela precisou de algo que o spec não diz, a decisão é a mais conservadora, marcada como "definido pela UX" e listada em "Pendências para o PO". Os nomes são os da [massa de exemplo](#massa-de-exemplo), com os sobrenomes usados nos wireframes do E2.02 (Caio Lima, André Souza)._

### O que muda, tela a tela
| Tela | O que muda | Para quem |
|---|---|---|
| Login (T1) | texto "Esqueceu a senha? Fale com o seu líder."; a senha não vira maiúscula com "Mostrar senha" ligado | todos |
| Troca obrigatória (T2) | tela nova, sem menu, antes de qualquer outra | quem tem a marca |
| Alterar minha senha (T3) | diálogo novo, com a senha atual | todo membro com conta |
| Menu lateral (T4) | item "Alterar minha senha", acima de "Sair" | todos |
| Cadastro de membro (T5) | "Alterar Senha" vira "Redefinir senha"; as recusas previsíveis viram texto; o próprio cadastro ganha "Alterar minha senha"; a senha inicial vai para a seção Acesso, com dica e validação | quem cadastra e edita; o próprio membro |
| Redefinir senha (T6) | confirmação, senha temporária mostrada uma vez, copiar e compartilhar (só a senha), recusas | quem tem "Redefinir Senha de Membros" |
| Lista de Membros (T5) | "Redefinir senha" nas ações da linha (desktop) e no "⋯" do card (celular) (PO-UX-3, P-SEN-20) | quem tem "Redefinir Senha de Membros" |
| Funções (T7) | rótulo e dica da permissão | quem vê Funções |
| Auditoria (T8) | seis ações, segunda linha da descrição e campos no painel | quem audita |
| Sessão encerrada (T9) | sem mudança | todos |

### Decisões de experiência
| # | Decisão | Por quê |
|---|---|---|
| UXD-1 | **As regras da senha ficam acima do campo, e só o tamanho é conferido ao vivo.** No campo da senha nova, a ordem é rótulo, regras, campo e erro. A primeira frase das regras ("Use pelo menos 8 caracteres.") ganha um ícone que muda quando a senha chega a 8 caracteres. As outras regras são conferidas ao sair do campo e ao enviar, uma mensagem por vez, na ordem da RN-13. Sem medidor de força e sem lista marcada regra a regra. | No celular, o teclado cobre a metade de baixo da tela: acima do campo, as regras continuam visíveis enquanto a pessoa digita. O tamanho é a única regra que a pessoa vai cumprindo aos poucos; as outras são de "sim ou não" e não precisam de aviso a cada tecla. Uma lista marcada regra a regra mostraria, letra por letra, o que o sistema considera fraco, e o medidor de força está fora de escopo. |
| UXD-2 | **A troca obrigatória é uma tela própria, sem menu, com o visual do login.** Qualquer endereço leva a ela enquanto a marca existir (RN-09). O foco começa no título, e "Sair" fica embaixo, separado de "Salvar nova senha". | A pessoa acabou de entrar: o mesmo cartão do login mostra que ela ainda está "na porta". Sem menu, não há o que tocar e ser recusado. Com o foco no título, o leitor de tela anuncia onde a pessoa está, e o teclado não abre antes de ela ler o porquê. |
| UXD-3 | **A redefinição acontece num diálogo só, em dois passos:** a confirmação e, no sucesso, a senha temporária. Enquanto envia, nada fecha o diálogo. A tela da senha só fecha por "Concluir": `Esc` e o toque fora não fazem nada. | Se o diálogo fechasse durante o envio, ou por um toque fora sem querer, a senha gerada se perderia, e o líder teria de redefinir de novo (RN-04). |
| UXD-4 | **A senha temporária aparece para ser lida e ditada.** Fonte monoespaçada e grande, em dois grupos de 4 só no visual (sem espaço no texto), com "Só letras minúsculas e números." embaixo e, para o leitor de tela, a senha soletrada. "Copiar senha" é a ação principal, e "Compartilhar senha" aparece quando o aparelho oferece o compartilhamento. *"Compartilhar senha" é definido pela UX; pela decisão do PO, ele leva só os 8 caracteres, sem mensagem pronta (PO-UX-1, P-SEN-18).* | Os caracteres que se confundem já foram excluídos (P-SEN-03). Os grupos ajudam a ditar e a conferir. "Só letras minúsculas" evita que o membro digite a primeira letra maiúscula. No celular, compartilhar leva a senha direto à conversa com o membro, sem copiar e trocar de aplicativo. |
| UXD-5 | **"Concluir" fecha sem pedir confirmação, mesmo sem copiar.** O aviso "Ela não será mostrada de novo." fica em negrito, logo acima dos botões. *Definido pela UX (PO-UX-5).* | Quando o membro está ao lado, ele digita a senha olhando a tela, e copiar não faz sentido: uma confirmação a mais pesaria justamente no caso mais comum. Se o líder fechar antes de passar a senha, redefinir de novo resolve, e a anterior deixa de valer (RN-04). |
| UXD-6 | **"Alterar minha senha" fica no menu, acima de "Sair", e também no próprio cadastro, na seção Acesso.** *O segundo lugar é definido pela UX (PO-UX-2).* | O menu é o lugar que o Negócio definiu e fica a 2 toques de qualquer tela. No legado, o membro trocava a senha no próprio cadastro, na parte "Acesso" (`UI/pages/Members/details.js:507-528`): quem procurar ali também encontra. |
| UXD-7 | **No cadastro de outro membro, a recusa previsível vira texto no lugar do botão (P12).** Sem conta de acesso: "Este membro não tem acesso ao sistema.". Função não coberta, quando a tela sabe (AQ-2): "Você não tem permissão para redefinir a senha deste membro.". No próprio cadastro, o botão é "Alterar minha senha". | É o padrão da UXD-1 e da UXD-2 do E2.02: o líder não abre uma confirmação para receber uma recusa que a tela já conhecia. |
| UXD-8 | **A senha inicial vai para a seção Acesso, com o rótulo "Senha inicial (opcional)", "Mostrar senha" e sem "Confirmar senha".** A regra e a mensagem dos dados pessoais falam do membro, e não de "você". *Definido pela UX (PO-UX-4).* | Quem digita a senha inicial é o líder, então "não use o seu CPF" falaria do CPF dele. O legado tinha a senha em "Acesso". "Mostrar senha" confere o que foi digitado melhor que digitar de novo às cegas, e um erro aqui se resolve com uma redefinição. |
| UXD-9 | **Os formulários de senha fecham sem perguntar e voltam vazios.** "Cancelar", "✕" e `Esc` fecham o "Alterar minha senha" sem o "Descartar as alterações?", e "Sair" da troca obrigatória também não pergunta. | Nenhuma senha digitada deve ficar guardada na tela. Redigitar três campos curtos custa pouco, e uma confirmação a mais não protege nada. |
| UXD-10 | **Todo campo de senha tem "Mostrar senha" e nunca vira maiúscula sozinho (P15).** Isso inclui a senha do login (ajuste na T1 do E1.04). | A senha temporária é toda minúscula. Com "Mostrar senha" ligado, o campo vira texto, e o teclado do celular põe a primeira letra em maiúscula: a senha certa falharia e contaria para o bloqueio (RN-10 do E1.04). |
| UXD-11 | **Auditoria legível, como no E1.04 (UXD-8 de lá):** o motivo, o tipo de troca, a validade e a duração aparecem na segunda linha da descrição e, no painel, em campos com nome. | Quem audita quer ver "Função não coberta · Olga" sem abrir o JSON. |

### Navegação e rotas
- **Rota nova `/change-password`** (nome sugerido, AQ-3): a troca obrigatória (T2), fora do `AppLayout`.
  - Com a marca, qualquer rota protegida leva a ela com `replace`, e o `/login` também, porque a sessão existe.
  - Sem a marca, `/change-password` leva a `/`.
  - Depois da troca, `replace` para `/` (RN-10). O "voltar" do navegador não leva de novo à troca.
  - "Sair" leva ao `/login`, sem o aviso de sessão encerrada.
  - Quando a marca aparece no meio do uso (RN-09 c), a resposta recusada leva à troca, com `replace`, sem toast e sem mensagem. Os diálogos abertos fecham com a troca de rota.
- **"Alterar minha senha"** (T3) é um diálogo, sem rota, aberto pelo menu (T4) ou pelo próprio cadastro (T5).
- **"Redefinir senha"** (T6) é um diálogo sobre o cadastro do membro, sem rota.
- **Sessão encerrada** (RN-16): o login com "Sua sessão terminou. Entre de novo para continuar.", como no E2.01 e no E1.04.
- **Auditoria:** sem mudança de rota.

### Fluxos
Contagem no celular. "Toque" não conta a digitação, mas conta os botões do teclado ("próximo", "concluído") quando eles avançam o fluxo.

| # | História | Caminho | Toques e telas |
|---|---|---|---|
| F1 | O líder redefine e manda a senha por mensagem (André → Caio) | ☰ → Membros → busca "Caio" → ✎ → (rola até Acesso) → "Redefinir senha" → "Redefinir senha" (confirma) → "Compartilhar senha" → escolhe Caio no WhatsApp e envia → volta ao app → "Concluir" → ✕ no cadastro | 9 toques no app + 2 no WhatsApp; 1 tela e 2 diálogos |
| F2 | O líder redefine com o membro ao lado | F1 até a senha temporária → Caio digita a senha no próprio celular, olhando a tela → "Concluir" → ✕ | 8 toques |
| F3 | O membro entra com a senha temporária e cria a nova (Caio) | login (F1 do E1.04, 3 toques) → troca obrigatória → toca em "Nova senha" → digita → "próximo" → digita → "concluído" → Dashboard | 3 + 3 toques; 3 telas |
| F4 | Primeiro acesso com `123456` (Mateus) ou com senha fora das regras (Gabriel) | igual ao F3 | igual ao F3 |
| F5 | Troca voluntária pelo menu (Hugo) | ☰ → "Alterar minha senha" (foco em "Senha atual") → digita → "próximo" → digita → "próximo" → digita → "concluído" → toast | 5 toques; 1 diálogo |
| F6 | Troca voluntária pelo próprio cadastro (Caio) | ☰ → ✎ "Editar meus dados" → (rola até Acesso) → "Alterar minha senha" → o F5 a partir do diálogo | 6 toques |
| F7 | Senha atual errada | F5 → "A senha atual não confere." embaixo do campo, que é limpo e recebe o foco → digita → "concluído" | +1 toque (+1 se o teclado não abrir sozinho) |
| F8 | Nova senha recusada pela política | envio → mensagem embaixo de "Nova senha", com a nova senha e a confirmação limpas e o foco em "Nova senha" → digita as duas → "concluído" | +2 toques |
| F9 | Sem conexão na casa do anfitrião | envio → mensagem de conexão no topo, campos mantidos → "Salvar nova senha" (ou "Redefinir senha") de novo | +1 toque, sem redigitar |
| F10 | Alvo sem conta ou com função acima (André abre Lauro ou Olga) | abre o cadastro → o texto aparece no lugar do botão | nenhum toque a mais e nenhuma recusa depois de confirmar |
| F11 | O líder cadastra um membro com senha inicial (Pedro) | "Novo membro" → dados → Acesso → "Senha inicial (opcional)" → digita → "Criar membro" | igual a hoje, +1 toque no campo |
| F12 | A marca aparece durante o uso (Vera, na publicação) | qualquer ação → troca obrigatória, sem mensagem → o F3 a partir da troca | nenhum toque a mais para chegar |
| F13 | Quem audita procura as redefinições (Rita, desktop) | Auditoria → "Ação" → "Senha redefinida" → linha → painel | 4 cliques |

### Telas
Convenções do E2.01 e do E1.04: 360 px ≈ 38 colunas; `[Botão]` é botão; `[◉]` é "Mostrar senha"; `⚠` é erro; `◷` é o ícone de relógio; `(i)` é aviso. Novos: `○` e `●` são o ícone da regra ao vivo (`Circle` e `CircleCheck`); `⧉` é copiar (`Copy`); `↗` é compartilhar (`Share2`); `🔑` é o ícone `KeyRound`; `✓` é `Check`.

#### T1. Login (ajuste na T1 do E1.04)
Celular, parte de baixo do cartão:
```
│ Senha                                │
│ [••••••••                      [◉]] │  autoCapitalize="none" (UXD-10)
│ [              Entrar              ] │
│                                      │
│ Esqueceu a senha? Fale com o seu     │  <p>, text-sm, cor muted, centralizado
│ líder.                               │  sem link e sem botão
└──────────────────────────────────────┘
```
- **Texto (RN-15):** um `<p className="mt-4 text-center text-sm text-muted-foreground">` dentro do `CardContent`, depois do `<form>`.
  - Não é link nem botão e não muda com o que foi digitado nem com as mensagens.
  - `text-muted-foreground` sobre o cartão dá cerca de 4,9:1 no tema claro e 5,1:1 no escuro.
  - A mensagem de bloqueio do E1.04 já termina com "Se esqueceu a senha, fale com o seu líder.". A repetição com o texto fixo de baixo é aceitável.
- **Campo Senha:** soma `autoCapitalize="none"`, `autoCorrect="off"` e `spellCheck={false}` aos atributos da T1 do E1.04 (UXD-10, P15).
- **Desktop:** o mesmo texto, no mesmo lugar do cartão.
- O resto da T1 do E1.04 não muda. O UX-14 de lá ("Entrar" visível em 360×800) continua valendo, porque o texto fica abaixo do botão.

#### T2. Troca obrigatória (`/change-password`, nova)
Celular (360 px), com o fundo `bg-primary` e `p-4`, como o login:
```
Inicial                                  Política recusada
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│              (logo 56)               │ │              (logo 56)               │
│ Crie uma nova senha                  │ │ Crie uma nova senha                  │  h1
│ Para continuar, crie uma nova senha. │ │ Para continuar, crie uma nova senha. │
│ Ela substitui a senha que você usou  │ │ Ela substitui a senha que você usou  │
│ para entrar.                         │ │ para entrar.                         │
│                                      │ │                                      │
│ Nova senha                           │ │ Nova senha                           │
│ ○ Use pelo menos 8 caracteres.       │ │ ● Use pelo menos 8 caracteres.       │  ao vivo
│ Evite sequências (12345678),         │ │ Evite sequências (12345678),         │
│ repetições (11111111) e senhas       │ │ repetições (11111111) e senhas       │
│ comuns, e não use o seu CPF, celular │ │ comuns, e não use o seu CPF, celular │
│ ou data de nascimento.               │ │ ou data de nascimento.               │
│ [                               [◉]] │ │ [|                              [◉]] │  limpo, foco
│ Confirmar nova senha                 │ │ ⚠ Esta senha é fácil de adivinhar.   │  aria-invalid
│ [                               [◉]] │ │   Escolha outra.                     │
│ [        Salvar nova senha         ] │ │ Confirmar nova senha                 │
│                                      │ │ [                               [◉]] │  limpo
│ [⎋              Sair               ] │ │ [        Salvar nova senha         ] │
└──────────────────────────────────────┘ │ [⎋              Sair               ] │
                                         └──────────────────────────────────────┘

Conexão ou servidor                      Enviando
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Crie uma nova senha                  │ │ …                                    │
│ Para continuar, …                    │ │ [••••••••                      [◉]] │
│ ┌──────────────────────────────────┐ │ │ Confirmar nova senha                 │
│ │⚠ Não foi possível salvar a nova  │ │ │ [••••••••                      [◉]] │
│ │  senha. Verifique a conexão e    │ │ │ [     (◌) Salvando…              ] │  desabilitado
│ │  tente de novo.                  │ │ │ [⎋              Sair               ] │  desabilitado
│ └──────────────────────────────────┘ │ └──────────────────────────────────────┘
│ Nova senha                           │
│ …                                    │  os dois campos mantidos
└──────────────────────────────────────┘
```
Desktop (≥ 1024 px): o mesmo cartão, centralizado, com `max-w-md`, como o login. Nada muda de estrutura.
```
┌───────────────────────────────────────────────────────────────────────┐ bg-primary
│                  ┌──────────────────────────────────┐                 │
│                  │            (logo 56)             │                 │
│                  │ Crie uma nova senha              │                 │
│                  │ Para continuar, crie uma nova    │                 │
│                  │ senha. Ela substitui a senha que │                 │
│                  │ você usou para entrar.           │                 │
│                  │ Nova senha                       │                 │
│                  │ ○ Use pelo menos 8 caracteres.   │                 │
│                  │ Evite sequências (12345678), …   │                 │
│                  │ [                            [◉]]│                 │
│                  │ Confirmar nova senha             │                 │
│                  │ [                            [◉]]│                 │
│                  │ [       Salvar nova senha      ] │                 │
│                  │ [⎋            Sair             ] │                 │
│                  └──────────────────────────────────┘                 │
└───────────────────────────────────────────────────────────────────────┘
```
- **Estrutura (P18):** `min-h-dvh`, `bg-primary`, `p-4`, e o `Card` do login: largura toda abaixo de `sm` e `max-w-md` a partir dali.
  - O logotipo tem 56 px (no login, 80), para sobrar altura.
  - Nada do `AppLayout`: sem menu e sem ☰.
  - Em paisagem ou com a fonte grande, a página rola. Nada é cortado.
- **Título:** `<h1>` visível, "Crie uma nova senha", com `tabIndex={-1}`. Ele recebe o foco ao abrir, com o anel só no `focus-visible`. O teclado não abre sozinho.
- **Espaço de mensagens:** um `Alert` entre o texto e "Nova senha", só para conexão, erro do servidor e tempo-limite, como na UXD-1 do E1.04. Os erros de campo ficam embaixo do campo.
- **Nova senha:** campo do P15, com `autoComplete="new-password"` e `enterKeyHint="next"`, e com as regras do P16 entre o rótulo e o campo.
- **Confirmar nova senha:** campo do P15, com `autoComplete="new-password"` e `enterKeyHint="done"`.
- **Gerenciador de senhas:**
  - com os dois campos em `new-password`, o Chrome e o Safari oferecem uma senha forte e preenchem os dois;
  - `passwordrules="minlength: 8; maxlength: 72;"` nos dois campos, para o Safari gerar dentro da política;
  - se a tela tiver a identificação usada no login (no estado da navegação vindo do login), um campo oculto com `autoComplete="username"` e esse valor ajuda o gerenciador a atualizar a senha certa. Sem ela, o campo não existe.
- **Enter:** em "Nova senha", com a confirmação vazia, leva o foco à confirmação, sem mensagem e sem envio. Com as duas preenchidas, envia (como a UXD-7 do E1.04).
- **Validação (P16):** ao sair de cada campo e ao enviar.
  - Política: a mensagem fica embaixo de "Nova senha"; a nova senha e a confirmação são limpas, e o foco vai para "Nova senha".
  - Confirmação diferente: "As senhas não conferem." embaixo da confirmação, que é limpa e recebe o foco.
  - Campo vazio ao enviar: "Informe a nova senha." ou "Confirme a nova senha." †, com o foco no primeiro campo vazio.
  - Nada é enviado quando a tela já encontrou um erro.
- **Envio:** "Salvar nova senha" (`size="lg"`, `w-full`) vira "Salvando…" †, com `Loader2`, e fica desabilitado, assim como "Sair". Um duplo toque gera um envio só. A cada envio, os "Mostrar senha" voltam a ocultar.
- **Sair:** `Button variant="ghost" size="lg"`, `w-full`, com `LogOut`, a 16 px de "Salvar nova senha" (`mt-4`). Não pede confirmação (UXD-9). O logout é registrado, como hoje (AQ-3).
- **Sucesso:** `replace` para `/`, com o toast "Senha alterada. Use a nova senha da próxima vez que entrar." †. A tela relê o acesso (P13), e o menu aparece com os itens da função da pessoa.
- **Outra aba do mesmo navegador:** quando a sessão é atualizada sem a marca, ela sai da troca sozinha e vai para `/`.
- Componentes: `Card`, `Label`, `Input`, `Button`, `Alert`. Nenhum componente novo.

#### T3. Alterar minha senha (diálogo, novo)
Celular: diálogo responsivo (P1), em tela cheia.
```
Inicial                                  Senha atual errada
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ ✕  Alterar minha senha               │ │ ✕  Alterar minha senha               │  cabeçalho fixo
│──────────────────────────────────────│ │──────────────────────────────────────│
│ Senha atual                          │ │ Senha atual                          │
│ [|                              [◉]] │ │ [|                              [◉]] │  limpa, foco
│                                      │ │ ⚠ A senha atual não confere.         │
│ Nova senha                           │ │ Se não lembra a senha atual, fale    │  † a partir do
│ ○ Use pelo menos 8 caracteres.       │ │ com o seu líder.                     │  1º erro
│ Evite sequências (12345678),         │ │ Nova senha                           │
│ repetições (11111111) e senhas       │ │ ● Use pelo menos 8 caracteres.       │
│ comuns, e não use o seu CPF, celular │ │ Evite sequências (12345678), …       │
│ ou data de nascimento.               │ │ [••••••••••                     [◉]] │  mantida
│ [                               [◉]] │ │ Confirmar nova senha                 │
│ Confirmar nova senha                 │ │ [••••••••••                     [◉]] │  mantida
│ [                               [◉]] │ │                                      │
│──────────────────────────────────────│ │──────────────────────────────────────│
│ [Cancelar]       [Salvar nova senha] │ │ [Cancelar]       [Salvar nova senha] │  rodapé fixo
└──────────────────────────────────────┘ └──────────────────────────────────────┘

Bloqueio (RN-12)
┌──────────────────────────────────────┐
│ ✕  Alterar minha senha               │
│──────────────────────────────────────│
│ ┌──────────────────────────────────┐ │
│ │◷ Muitas tentativas sem sucesso.  │ │  recebe o foco (tabIndex=-1),
│ │  Aguarde 15 minutos e tente de   │ │  sem role="alert"
│ │  novo.                           │ │
│ └──────────────────────────────────┘ │
│ Senha atual                          │
│ [                               [◉]] │  limpa
│ …                                    │
│ [Cancelar]       [Salvar nova senha] │  habilitado, sem contagem
└──────────────────────────────────────┘
```
Desktop (a partir de 768 px): `Dialog` centralizado, com `max-w-md`, o mesmo conteúdo e o rodapé alinhado à direita.
- **Diálogo responsivo (P1):** tela cheia abaixo de `md`, com cabeçalho e rodapé fixos e o corpo rolando.
- **Ordem:** espaço de mensagens, "Senha atual", "Nova senha" (com as regras do P16) e "Confirmar nova senha". As regras ficam depois da senha atual, logo antes do campo a que se referem.
- **Senha atual:** campo do P15, com `autoComplete="current-password"` e `enterKeyHint="next"`. Ela recebe o foco ao abrir, e o teclado abre: a pessoa pediu para trocar a senha.
- **Nova senha e confirmação:** como na T2. Na troca voluntária, a tela também confere os dados pessoais, com o cadastro da própria pessoa (AQ-6).
- **Enter:** como na T2. Num campo com algum campo seguinte vazio, o foco vai para o primeiro vazio. Com todos preenchidos, envia.
- **Senha atual errada (RN-11):** a mensagem fica embaixo do campo, que é limpo e recebe o foco. A nova senha e a confirmação ficam como estavam. A partir do primeiro erro, aparece também "Se não lembra a senha atual, fale com o seu líder." † (PO-UX-6), em `text-sm text-muted-foreground`.
- **Bloqueio (RN-12):**
  - o `Alert` do topo, com `Clock`, traz o {N} da resposta ("1 minuto", no singular);
  - ele recebe o foco (`tabIndex={-1}`) e não usa `role="alert"`, para não ser lido duas vezes;
  - a senha atual é limpa, e "Salvar nova senha" continua habilitado, sem contagem regressiva;
  - a mensagem some sem anúncio depois de {N} minutos (UXD-2 e UXD-3 do E1.04);
  - a 5ª tentativa errada já recebe a mensagem de bloqueio.
- **Conexão, erro do servidor ou tempo-limite:** `Alert` com `WifiOff` e `role="alert"`; todos os campos ficam, e o foco não muda.
- **Sessão encerrada no meio** (por exemplo, a senha foi redefinida por outra pessoa): o login com o aviso do E2.01.
- **Sucesso:**
  - o diálogo fecha, os campos são limpos, e aparece o toast "Senha alterada. Nos outros aparelhos, será preciso entrar de novo.";
  - o foco volta para o lugar de onde a pessoa veio: no celular, o ☰ (o menu já fechou); no desktop, o item "Alterar minha senha"; no próprio cadastro, o botão.
- **Fechar (UXD-9):** "Cancelar", "✕" e `Esc` fecham sem perguntar, e o diálogo abre vazio da próxima vez. Durante o envio, nada fecha o diálogo.
- Componentes: `Dialog` (com o P1), `Label`, `Input`, `Button`, `Alert`.

#### T4. Menu lateral (ajuste na T1 do E2.02)
Celular (`Sheet` de 256 px), com Caio:
```
│────────────────────────────│
│ Caio Lima           [✎]    │
│ Membro                     │
│ 🔑 Alterar minha senha     │  min-h-11
│ ⎋  Sair                    │  min-h-11, 8 px abaixo
└────────────────────────────┘
```
- **Item:** um `<button>` com o ícone `KeyRound` (`aria-hidden`) e o texto "Alterar minha senha", no mesmo estilo de "Sair", com `min-h-11` e 8 px de distância de "Sair".
- **Quem vê:** todo membro com cadastro (Rita, Pedro, Caio, Hugo), inclusive quem tem só "Ver meus dados" e quem está sem função. A conta X não entra (RN-06 do E1.04).
- **Toque:** no celular, fecha o `Sheet` e abre a T3.
- **Desktop:** igual, na barra lateral fixa.

#### T5. Cadastro de membro (`MemberForm`): seção Acesso (ajuste na T6 do E2.02)
Celular. A seção Acesso tem a Função (como na T6 do E2.02) e a linha "Senha".
```
André editando Caio                      Depois da redefinição
│ Acesso                               │ │ Senha                                │
│ (Função, como na T6 do E2.02)        │ │ [🔑 Redefinir senha               ] │
│ Senha                                │ │ ✓ Senha redefinida às 21:50. Não é   │  †, aria-describedby
│ [🔑 Redefinir senha               ] │ │   preciso salvar o cadastro.         │

André editando Lauro (sem conta)         André editando Olga (função acima, AQ-2)
│ Senha                                │ │ Senha                                │
│ Este membro não tem acesso ao        │ │ Você não tem permissão para redefinir│
│ sistema.                             │ │ a senha deste membro.                │

Caio no próprio cadastro                 Pedro cadastrando Mateus
│ Senha                                │ │ Acesso                               │
│ [🔑 Alterar minha senha           ] │ │ Função                               │
                                         │ Membro (padrão)                      │
                                         │ Novos membros recebem a função       │
                                         │ padrão.                              │
                                         │ Senha inicial (opcional)             │  †
                                         │ Se ficar em branco, a senha inicial  │
                                         │ é 123456. No primeiro acesso, o      │
                                         │ membro cria a própria senha.         │
                                         │ Use pelo menos 8 caracteres. Evite   │  † 3ª pessoa
                                         │ sequências (12345678), repetições    │
                                         │ (11111111) e senhas comuns, e não use│
                                         │ o CPF, o celular ou a data de        │
                                         │ nascimento do membro.                │
                                         │ [                               [◉]] │
```
Desktop: a seção Acesso continua em duas colunas: a Função à esquerda e a linha "Senha" (ou "Senha inicial") à direita, com as dicas na mesma coluna.
- **Linha "Senha" na edição.** Substitui o botão "Alterar Senha" e o diálogo "Nova Senha", que saem.

| Situação | O que aparece |
|---|---|
| Outro membro, com a permissão, com conta e com a função coberta | o botão "Redefinir senha" (`outline`, `size="lg"`, `w-full` no celular, `KeyRound`) |
| Outro membro sem conta (`auth_user_id` nulo) | o texto "Este membro não tem acesso ao sistema." |
| Outro membro com a função não coberta (quando a tela sabe, AQ-2) | o texto "Você não tem permissão para redefinir a senha deste membro." |
| Quem não tem a permissão, no cadastro de outra pessoa | nada, nem o rótulo "Senha" |
| O próprio cadastro ("Editar meus dados" ou "Ver meus dados") | o botão "Alterar minha senha", que abre a T3 (UXD-6) |

- **Rótulo "Senha":** um `<p className="text-sm font-medium">` (P12), porque não há campo.
- **Carregando:** enquanto a tela não sabe se a redefinição é possível (AQ-2), a linha mostra um `Skeleton` de `h-11`.
- **Depois da redefinição:** aparece embaixo do botão "Senha redefinida às {hh:mm}. Não é preciso salvar o cadastro." †, com `Check`, ligado ao botão por `aria-describedby`. A linha some quando o cadastro fecha. Ela deixa claro que a redefinição não depende de "Salvar".
- **Senha inicial no cadastro novo (UXD-8):**
  - sai de "Dados Pessoais" e vai para "Acesso", abaixo da Função no celular e ao lado dela no desktop;
  - rótulo "Senha inicial (opcional)" †, sem o placeholder "Padrão: 123456";
  - campo do P15, com `autoComplete="off"` e os atributos de exclusão dos gerenciadores mais comuns (`data-1p-ignore`, `data-lpignore="true"` e `data-bwignore`): é a senha de outra pessoa, e o gerenciador de quem cadastra não deve sugerir nem salvar. Conferir no Chrome do Android que nenhum "Salvar senha?" aparece ao criar o membro;
  - dica entre o rótulo e o campo (P16, sem o ícone ao vivo, porque o campo é opcional): a frase do Negócio sobre a `123456` e, em seguida, a regra em terceira pessoa †;
  - validação ao sair do campo e ao enviar, com os dados digitados no próprio formulário (CPF, celular, nascimento e e-mail). Vazio e `123456` não dão erro (RN-07). A mensagem dos dados pessoais fala do membro †. O erro do servidor aparece no mesmo lugar (AQ-8);
  - sem "Confirmar senha".
- **Lista de Membros (PO-UX-3, resolvida pelo PO: P-SEN-20).** "Redefinir senha" (`KeyRound`) entra no "⋯" do card (celular) e nas ações da linha (desktop), para quem tem a permissão, e abre a mesma T6.
  - Não aparece na linha da própria pessoa nem na de quem não tem conta (`auth_user_id` nulo). Na função não coberta, segue a AQ-2: com ela, o item não aparece; sem ela, a recusa vem depois de confirmar.
  - Ao fechar a T6, o foco volta para o botão de ações daquela linha ou card.
  - Assim, quem tem a permissão sem "Editar Membro" também alcança a ação. O `ux-designer` pode detalhar na revisão.
- Componentes: os de hoje (`Button`, `Input`, `Label`), mais `Skeleton` e o `AlertDialog` da T6.

#### T6. Redefinir senha: confirmação, senha temporária e recusas
Celular. `AlertDialog` com o P9 (`w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto`).
```
Confirmação                              Enviando
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Redefinir a senha de Caio Lima?      │ │ Redefinir a senha de Caio Lima?      │
│                                      │ │                                      │
│ • A senha atual de Caio deixa de     │ │ • … (os mesmos tópicos)              │
│   funcionar agora.                   │ │                                      │
│ • Se Caio estiver conectado, terá que│ │ [    (◌) Redefinindo…              ] │  desabilitado
│   entrar de novo.                    │ │ [Cancelar                          ] │  desabilitado
│ • Você vai receber uma senha         │ └──────────────────────────────────────┘
│   temporária, válida por 7 dias, para│    Esc e toque fora não fecham
│   passar a Caio.                     │
│ • No próximo acesso, Caio cria uma   │
│   nova senha.                        │
│ [Redefinir senha                   ] │  default, h-11
│ [Cancelar                          ] │  outline, h-11, foco inicial
└──────────────────────────────────────┘

Senha temporária                         Depois de copiar
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Senha temporária de Caio Lima        │ │ …                                    │  recebe o foco
│ ┌──────────────────────────────────┐ │ │ [✓ Senha copiada                   ] │  mesmo tamanho;
│ │           k7m2  x9pa             │ │ │ [↗ Compartilhar senha              ] │  role="status"
│ └──────────────────────────────────┘ │ │ [Concluir                          ] │  anuncia
│ Só letras minúsculas e números.      │ └──────────────────────────────────────┘
│ ◷ Válida até 30/11/2026 às 21:50.    │
│                                      │
│ Passe esta senha a Caio pessoalmente │
│ ou por mensagem direta. Ela não será │
│ mostrada de novo.                    │  esta frase em font-semibold
│ Caio entra com o CPF, o celular ou o │
│ e-mail do cadastro e esta senha, e   │
│ cria uma nova senha em seguida.      │
│ [⧉ Copiar senha                    ] │  default, h-11
│ [↗ Compartilhar senha              ] │  outline, h-11; só com Web Share
│ [Concluir                          ] │  outline, h-11; Esc e toque fora não fecham
└──────────────────────────────────────┘

Recusa (P3)                              Conexão ou servidor
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Não foi possível redefinir a senha   │ │ Redefinir a senha de Caio Lima?      │
│                                      │ │ ┌──────────────────────────────────┐ │
│ Você não tem permissão para redefinir│ │ │⚠ Não foi possível redefinir a    │ │  role="alert"
│ a senha deste membro.                │ │ │  senha. Verifique a conexão e    │ │
│ [Fechar                            ] │ │ │  tente de novo.                  │ │
└──────────────────────────────────────┘ │ └──────────────────────────────────┘ │
                                         │ • … (os mesmos tópicos)              │
                                         │ [Redefinir senha                   ] │  serve de
                                         │ [Cancelar                          ] │  "Tentar de novo"
                                         └──────────────────────────────────────┘
```
Desktop: o `AlertDialog` centralizado (`sm:max-w-lg`), com os botões em linha, alinhados à direita. Na senha temporária, "Copiar senha" fica à direita, e a ordem do foco segue a do celular.
- **Confirmação (P9):**
  - título com o nome completo; os quatro tópicos do Negócio numa `<ul>`, com o primeiro nome † e "conectado" ou "conectada" conforme o gênero do cadastro ("conectado" quando não há gênero);
  - "Redefinir senha" usa o `variant="default"`, e não o `destructive`: a ação não apaga nada;
  - "Cancelar" (`outline`) recebe o foco inicial.
- **Envio (UXD-3):** "Redefinindo…" †, com `Loader2`, e os dois botões desabilitados. `Esc` e o toque fora não fecham (`onEscapeKeyDown` e `onPointerDownOutside` com `preventDefault`). Um duplo toque gera um pedido só.
- **Senha temporária (P17, UXD-4):** o mesmo diálogo troca de conteúdo (ou um novo `AlertDialog` abre no lugar, à escolha do front), e o foco vai para o título.
  - A senha: um `<p translate="no">` com `font-mono text-3xl tracking-widest select-all`, sobre `bg-muted rounded-md`, com `aria-hidden`. Dentro, dois `<span>` de 4 caracteres separados por `gap-3` (`flex flex-wrap justify-center`), sem espaço no texto.
  - Para o leitor de tela, ao lado: `<span className="sr-only">Senha: k, 7, m, 2, x, 9, p, a.</span>` †.
  - "Só letras minúsculas e números." †, em `text-sm text-muted-foreground`.
  - "Válida até {dd/mm/aaaa} às {hh:mm}.", com `Clock`, no horário de Brasília, a partir da validade devolvida pelo servidor, e não do relógio do aparelho (AQ-1).
  - Os dois parágrafos do Negócio, com o primeiro nome †. "Ela não será mostrada de novo." em `font-semibold`.
  - Botões, empilhados no celular nesta ordem, todos com `h-11`: "Copiar senha" (`default`, `Copy`), "Compartilhar senha" † (`outline`, `Share2`, só quando existe `navigator.share`) e "Concluir" (`outline`).
- **Copiar senha:**
  - copia só os 8 caracteres (`navigator.clipboard.writeText`);
  - o botão vira "Senha copiada", com `Check`, por 3 segundos, sem mudar de tamanho, e um `role="status"` anuncia "Senha copiada.";
  - se a cópia falhar, a senha fica selecionada, e aparece "Não foi possível copiar. Selecione a senha para copiá-la." †.
- **Compartilhar senha (PO-UX-1, resolvida pelo PO: P-SEN-18):** abre o compartilhamento do aparelho só com os 8 caracteres da senha, sem saudação, validade nem endereço. O sistema não envia nada: quem escolhe o contato e explica o resto na conversa é o líder (RN-03). Desistir do compartilhamento não é erro e não mostra nada.
- **Concluir (UXD-5):** fecha sem perguntar.
  - Depois de fechar, a senha não fica no DOM, no cache do React Query, no `localStorage`, no `sessionStorage`, na URL nem no console.
  - O foco volta para "Redefinir senha", com a linha "Senha redefinida às {hh:mm}…" (T5).
  - Se o líder fechar antes de passar a senha, o caminho é redefinir de novo: a senha anterior deixa de valer (RN-04), e as duas redefinições ficam na Auditoria.
- **Recusas (RN-02, RN-06):** o conteúdo vira o diálogo de bloqueio (P3), com o título "Não foi possível redefinir a senha" †, a mensagem do Negócio e "Fechar", que recebe o foco. Depois de fechar:
  - "Este cadastro não existe ou já foi excluído.": o cadastro também fecha, e a lista recarrega (T11 do E2.02);
  - "Você não tem permissão para redefinir senhas.": a tela relê o acesso (P13), e o botão some;
  - "Você não tem permissão para redefinir a senha deste membro." e "Este membro não tem acesso ao sistema.": o botão vira o texto da T5;
  - limite: a mensagem traz o {N} da resposta ("1 minuto", no singular), e o botão continua;
  - `Para trocar a sua senha, use "Alterar minha senha".` só aparece em corrida, porque o botão não existe no próprio cadastro.
- **Conexão, erro do servidor ou tempo-limite:** a confirmação continua aberta, com o `Alert` "Não foi possível redefinir a senha. Verifique a conexão e tente de novo." (`role="alert"`, `WifiOff`), e "Redefinir senha" volta a ficar habilitado, como "Tentar de novo". Se o servidor gravou e a resposta se perdeu, o novo envio gera outra senha e invalida a perdida (RN-04), então tentar de novo é seguro.
- Componentes: `AlertDialog` (com o P9 e o P3), `Alert`, `Button`. Nenhum componente novo.

#### T7. Funções (ajuste na T3 do E2.02)
Formulário de função, grupo "Membros":
```
│ Membros                              │
│ [x] Criar Membro                     │
│ [x] Editar Membro                    │
│ [x] Excluir Membro                   │
│ [x] Editar Próprio Cadastro          │
│     Só os dados pessoais. …          │
│ [x] Redefinir Senha de Membros       │  rótulo novo (RN-01)
│     Gera uma senha temporária para os│  dica do Negócio
│     membros que a pessoa vê, só de   │
│     funções com permissões que ela   │
│     também tem. O membro cria uma    │
│     nova senha no próximo acesso.    │
```
- A permissão fica onde estava "Alterar Senha de Membros", no grupo "Membros", com a dica ligada por `aria-describedby` (P14).
- Na lista (T2 do E2.02), a Líder passa de "12 permissões" para "13 permissões", com o badge "Redefinir Senha de Membros".
- "Alterar Senha de Membros" não aparece em lugar nenhum: formulário, badges e lista.

#### T8. Auditoria (ajuste na T2 do E1.04)
Linhas (a mesma tabela no celular, com a rolagem horizontal de hoje). A coluna Entidade segue a AQ-7 e foi omitida aqui.
```
| Data/Hora        | Autor       | Ação                        | Descrição                              | Status |
|------------------|-------------|-----------------------------|----------------------------------------|--------|
| 23/11/2026 22:10 | Caio Lima   | [Senha alterada]            | Senha alterada                         | [OK]   |
|                  |             |                             | Obrigatória                            |        |
| 23/11/2026 21:50 | André Souza | [Senha redefinida]          | Senha redefinida                       | [OK]   |
|                  |             |                             | Caio Lima · válida até 30/11/2026 às   |        |
|                  |             |                             | 21:50                                  |        |
| 23/11/2026 21:48 | André Souza | [Senha redefinida (recusa)] | Redefinição de senha recusada          | [Erro] |
|                  |             |                             | Função não coberta · Olga              |        |
| 23/11/2026 21:30 | Caio Lima   | [Senha alterada (bloqueio)] | Troca de senha bloqueada por excesso   | [Erro] |
|                  |             |                             | de tentativas · 15 minutos             |        |
| 23/11/2026 21:29 | Caio Lima   | [Senha alterada (falha)]    | Falha na troca de senha                | [Erro] |
|                  |             |                             | Senha atual incorreta                  |        |
| 23/11/2026 20:00 | —           | [Troca de senha exigida]    | Troca de senha exigida                 | [OK]   |
|                  |             |                             | Senha inicial · Vera                   |        |
```
Painel de detalhes (`Sheet`, largura toda no celular):
```
Senha redefinida                         Redefinição recusada
┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
│ Detalhes do evento               [✕] │ │ Detalhes do evento               [✕] │
│ 23/11/2026 21:50                     │ │ 23/11/2026 21:48                     │
│ Autor                                │ │ Autor                                │
│ André Souza                          │ │ André Souza                          │
│ Ação               Entidade          │ │ Ação               Entidade          │
│ Senha redefinida   (AQ-7)            │ │ Senha redefinida   (AQ-7)            │
│                                      │ │ (recusa)                             │
│ Cadastro                             │ │ Cadastro                             │
│ Caio Lima                            │ │ Olga                                 │
│ Descrição                            │ │ Descrição                            │
│ Senha redefinida                     │ │ Redefinição de senha recusada        │
│ Validade                             │ │ Motivo                               │
│ 30/11/2026 às 21:50                  │ │ Função não coberta                   │
└──────────────────────────────────────┘ └──────────────────────────────────────┘
```
- **Ação:** os seis rótulos do Negócio entram no `ACTION_LABELS` ("Senha alterada" já existe). O filtro "Ação" é montado a partir dele, e a ordem fica: Login, Login (falha), Login (bloqueio), Logout, Senha redefinida, Senha redefinida (recusa), Senha alterada, Senha alterada (falha), Senha alterada (bloqueio) e Troca de senha exigida.
- **Segunda linha da descrição** †, em `text-sm text-muted-foreground`, unida por " · ":
  - Senha redefinida: o cadastro alvo e "válida até {dd/mm/aaaa} às {hh:mm}";
  - Redefinição recusada: o motivo e, quando há, o cadastro alvo;
  - Senha alterada: o tipo de troca;
  - Falha na troca: o motivo;
  - Bloqueio da troca: a duração ("15 minutos");
  - Troca de senha exigida: o motivo e o cadastro.
- **Autor:** quem redefiniu ou tentou redefinir; o próprio membro na troca, na falha, no bloqueio e na marca posta no login; "—" na marca posta pela publicação (AQ-7).
- **Painel:** campos com nome (Cadastro, Motivo, Tipo de troca, Validade e Duração), só os que têm valor, sem o bloco "Metadados" em JSON, e com o "Motivo" em `text-foreground`, como na T2 do E1.04. Nenhuma senha, hash ou origem aparece.
- **Login:** a falha com o motivo "Senha temporária vencida" (RN-05) aparece como as outras falhas da T2 do E1.04. Nada mais muda.

#### T9. Sessão encerrada (sem mudança)
O aviso "Sua sessão terminou. Entre de novo para continuar." do E2.01 e do E1.04 vale para as sessões encerradas por este passo: todas as do alvo, na redefinição, e as dos outros aparelhos, na troca (RN-16). O texto não diz o motivo (P-DEL-21 do E2.01).

### Padrões novos (valem para as próximas telas)
A numeração continua a de Escolas (P1 a P6), a do E2.01 (P7 a P9) e a do E2.02 (P10 a P14). Este passo também aplica o P1 (T3), o P3 e o P9 (T6), o P12 (T5) e o P13 (recusas e troca obrigatória).

- **P15. Campo de senha.** `Input` `h-11 pr-12`, com o botão "Mostrar senha" dentro, à direita: `Button variant="ghost"`, 44×44, `type="button"`, ícones `Eye` e `EyeOff`, `aria-pressed`, `aria-controls` e um `aria-label` com o nome do campo quando o formulário tem mais de um. A senha começa oculta e volta a ficar oculta a cada envio.
  - `autoCapitalize="none"`, `autoCorrect="off"` e `spellCheck={false}`, para o texto visível não virar maiúscula nem ser corrigido.
  - `autoComplete`: `current-password` para a senha em uso; `new-password` para a que a própria pessoa está criando; `off`, com os atributos de exclusão dos gerenciadores, para a senha de outra pessoa.
  - Sem `maxLength` (o limite é em bytes e é conferido pela política), sem bloquear o colar, e o valor vai como foi digitado, sem `trim`.
  - Vale para o login (E1.04), para este passo, para a recuperação por e-mail (E1.07) e para a primeira entrada com a senha do legado (E3.02).
- **P16. Regras da senha na tela.** No campo da senha nova, a ordem é rótulo, regras (dica), campo e erro, com as regras e o erro no `aria-describedby`.
  - A primeira frase das regras ("Use pelo menos 8 caracteres.") tem um ícone que muda de forma ao chegar a 8 caracteres (`Circle` → `CircleCheck`, com "(regra atendida)" para o leitor de tela), sem `aria-live`. Num campo opcional, o ícone não aparece.
  - As outras regras são conferidas ao sair do campo e ao enviar, uma mensagem por campo, na ordem da RN-13 e com os textos do Negócio. A tela confere o que consegue sem o servidor, e o servidor confere tudo e decide (AQ-6).
  - Na recusa da política, a senha nova e a confirmação são limpas, e o foco vai para a senha nova. Na confirmação diferente, só a confirmação é limpa.
  - Sem medidor de força e sem lista marcada regra a regra.
- **P17. Segredo mostrado uma vez.** Vale para qualquer valor que o sistema gera e não mostra de novo: a senha temporária e, no futuro, códigos e convites.
  - Ele aparece num diálogo que só fecha pela ação "Concluir" (`Esc` e o toque fora não fecham). Nada fecha o diálogo enquanto o pedido está em andamento.
  - Fica fora de qualquer `input`, em `font-mono` e grande, em grupos de 4 só no visual, com `translate="no"` e `select-all`. Para o leitor de tela, há uma versão `sr-only` soletrada, e o visual fica com `aria-hidden`.
  - A ação principal é "Copiar {coisa}", com a confirmação no próprio botão e em `role="status"`. "Compartilhar {coisa}" aparece só quando o aparelho oferece o compartilhamento.
  - O aviso de que ele não será mostrado de novo fica em negrito, perto dos botões.
  - O valor nunca vai para `localStorage`, `sessionStorage`, cache de consultas, URL ou console, e sai do DOM quando o diálogo fecha.
- **P18. Tela obrigatória antes de tudo.** Vale quando a pessoa precisa fazer algo antes de usar o sistema: a troca obrigatória e, no futuro, por exemplo, aceitar termos.
  - Rota própria, fora do `AppLayout`, no visual do login (`bg-primary`, `Card` com `max-w-md` e `min-h-dvh`), sem menu.
  - Qualquer rota protegida leva a ela com `replace`, e, ao concluir, a tela vai para `/` com `replace`.
  - O `h1` visível recebe o foco ao abrir.
  - Só a ação e "Sair", com "Sair" embaixo, em `ghost`, a 16 px da ação.

Nenhum componente novo do shadcn é necessário: `alert-dialog`, `dialog`, `alert`, `button`, `input`, `label`, `card`, `skeleton` e `toast` já estão em `src/components/ui`. O P1, o P3 e o P13 são implementados pelo E2.01 e pelo E2.02, que vêm antes. Copiar e compartilhar usam as APIs do navegador (`navigator.clipboard` e `navigator.share`), sem biblioteca. O P1 pede `viewport-fit=cover` na meta viewport do `index.html`, já prevista nos specs anteriores.

### Estados
| Estado | Troca obrigatória (T2) | Alterar minha senha (T3) | Cadastro e redefinição (T5, T6) | Login, menu, Funções e Auditoria (T1, T4, T7, T8) |
|---|---|---|---|---|
| Carregando | Nada a carregar: a tela abre direto. Enviando: "Salvando…", com os dois botões desabilitados | Enviando: "Salvando…", com os botões desabilitados; o diálogo não fecha | Linha "Senha" com `Skeleton h-11` enquanto a tela não sabe se a redefinição é possível (AQ-2). Enviando: "Redefinindo…", e nada fecha o diálogo | Sem mudança |
| Vazio | Campo vazio ao enviar: "Informe a nova senha." ou "Confirme a nova senha." † embaixo do campo, com o foco no primeiro vazio; nada é enviado | O mesmo, mais "Informe a senha atual." † | A senha inicial vazia é válida: vale a `123456` | Auditoria filtrada sem eventos: "Nenhum evento encontrado", como hoje |
| Erro | Política: mensagem embaixo de "Nova senha", com a nova senha e a confirmação limpas e o foco em "Nova senha". Confirmação diferente: só a confirmação é limpa e recebe o foco | Senha atual errada: mensagem embaixo do campo, que é limpo e recebe o foco. Bloqueio: `Alert` com o foco. Política e confirmação: como na T2 | Recusas: diálogo de bloqueio (T6). Senha inicial fora das regras: mensagem embaixo do campo, com o foco | — |
| Sem permissão | Não se aplica: sem a marca, a rota leva a `/` | Não se aplica: todo membro com conta troca a própria senha | Sem a permissão, nem a linha "Senha" (fora do próprio cadastro). Recusa do servidor: bloqueio e releitura do acesso (P13) | Funções e Auditoria: como no E2.02 (T12) |
| Sucesso | Vai para `/`, com o toast † | Toast do Negócio, com o diálogo fechado | A senha temporária (T6) e, depois, a linha "Senha redefinida às {hh:mm}…" | — |
| Lista grande | — | — | — | Auditoria: os 500 eventos mais recentes, como no E1.04 (AQ-6 de lá) |
| Queda de conexão no envio | `Alert` "Não foi possível salvar a nova senha…", com os campos mantidos; o botão serve de "Tentar de novo" (AQ-5) | O mesmo | `Alert` na confirmação; o botão serve de "Tentar de novo" | Login: como no E1.04 |
| Sessão encerrada e marca | Sessão encerrada no meio: login com o aviso do E2.01 | O mesmo | A redefinição encerra as sessões do alvo, e não as de quem redefiniu | Marca posta durante o uso: a T2, sem mensagem (RN-09 c) |

### Textos
Complementam os "Textos de tela" do Negócio, sem mudar termos. As mensagens de regra são as do Negócio. Os textos marcados com † foram definidos pela UX e estão nas pendências (PO-UX-8).

| Onde | Texto |
|---|---|
| Login, abaixo de "Entrar" | Esqueceu a senha? Fale com o seu líder. |
| Troca obrigatória | Crie uma nova senha (`h1`) · Para continuar, crie uma nova senha. Ela substitui a senha que você usou para entrar. · Nova senha · Confirmar nova senha · Salvar nova senha · Salvando… † · Sair |
| Troca obrigatória: sucesso (toast) † | Senha alterada. Use a nova senha da próxima vez que entrar. |
| Menu e próprio cadastro | Alterar minha senha |
| Alterar minha senha | Alterar minha senha (título) · Senha atual · Nova senha · Confirmar nova senha · Salvar nova senha · Salvando… † · Cancelar |
| Alterar minha senha: sucesso (toast) | Senha alterada. Nos outros aparelhos, será preciso entrar de novo. |
| Senha atual: ajuda depois do primeiro erro † | Se não lembra a senha atual, fale com o seu líder. |
| Regras, nas duas trocas | Use pelo menos 8 caracteres. Evite sequências (12345678), repetições (11111111) e senhas comuns, e não use o seu CPF, celular ou data de nascimento. |
| Regra ao vivo, só para o leitor de tela † | (regra atendida) |
| Campos vazios † | Informe a senha atual. · Informe a nova senha. · Confirme a nova senha. |
| Erros da nova senha | A senha precisa ter pelo menos 8 caracteres. · A senha é longa demais. · Esta senha é fácil de adivinhar. Escolha outra. · A senha não pode conter o seu CPF, o seu celular ou a sua data de nascimento, nem ser o seu e-mail. · A nova senha precisa ser diferente da atual. · As senhas não conferem. |
| Senha atual errada | A senha atual não confere. |
| Bloqueio da troca | Muitas tentativas sem sucesso. Aguarde {N} minutos e tente de novo. ("Aguarde 1 minuto", no singular) |
| Conexão na troca | Não foi possível salvar a nova senha. Verifique a conexão e tente de novo. |
| Mostrar senha (rótulos do botão de ícone) † | Com um campo só (login e senha inicial): Mostrar senha · Ocultar senha. Com mais de um: Mostrar senha atual · Ocultar senha atual · Mostrar nova senha · Ocultar nova senha · Mostrar confirmação da nova senha · Ocultar confirmação da nova senha |
| Cadastro: rótulos † | Senha (linha da edição) · Senha inicial (opcional) |
| Cadastro: dica da senha inicial | Se ficar em branco, a senha inicial é 123456. No primeiro acesso, o membro cria a própria senha. (Negócio) · Use pelo menos 8 caracteres. Evite sequências (12345678), repetições (11111111) e senhas comuns, e não use o CPF, o celular ou a data de nascimento do membro. † |
| Cadastro: erro dos dados pessoais † | A senha não pode conter o CPF, o celular ou a data de nascimento do membro, nem ser o e-mail do cadastro. |
| Cadastro: linha "Senha" | Redefinir senha · Alterar minha senha · Este membro não tem acesso ao sistema. · Você não tem permissão para redefinir a senha deste membro. · Senha redefinida às {hh:mm}. Não é preciso salvar o cadastro. † |
| Confirmação da redefinição | Redefinir a senha de {Nome}? · A senha atual de {Primeiro nome} deixa de funcionar agora. / Se {Primeiro nome} estiver conectado (ou conectada), terá que entrar de novo. / Você vai receber uma senha temporária, válida por 7 dias, para passar a {Primeiro nome}. / No próximo acesso, {Primeiro nome} cria uma nova senha. · Redefinir senha · Redefinindo… † · Cancelar. O primeiro nome e o gênero são ajustes de tom † |
| Senha temporária | Senha temporária de {Nome} · {senha} · Só letras minúsculas e números. † · Válida até {dd/mm/aaaa} às {hh:mm}. · Passe esta senha a {Primeiro nome} pessoalmente ou por mensagem direta. **Ela não será mostrada de novo.** · {Primeiro nome} entra com o CPF, o celular ou o e-mail do cadastro e esta senha, e cria uma nova senha em seguida. · Copiar senha · Senha copiada. · Compartilhar senha † · Concluir |
| Senha temporária, só para o leitor de tela † | Senha: {os caracteres, separados por vírgula}. |
| Cópia que falhou † | Não foi possível copiar. Selecione a senha para copiá-la. |
| Texto compartilhado | Só a senha: os 8 caracteres, sem mais texto (P-SEN-18). A mensagem pronta proposta na PO-UX-1 não foi adotada. |
| Recusas da redefinição | Título †: Não foi possível redefinir a senha · as mensagens do Negócio · Fechar |
| Conexão na redefinição | Não foi possível redefinir a senha. Verifique a conexão e tente de novo. |
| Funções | Redefinir Senha de Membros · a dica do Negócio |
| Auditoria: ação e filtro | Senha redefinida · Senha redefinida (recusa) · Senha alterada · Senha alterada (falha) · Senha alterada (bloqueio) · Troca de senha exigida |
| Auditoria: descrição | as do Negócio |
| Auditoria: segunda linha † | Redefinida: {Cadastro} · válida até {dd/mm/aaaa} às {hh:mm} · Recusa: {Motivo} · {Cadastro} · Alterada: {Tipo de troca} · Falha: {Motivo} · Bloqueio: {N} minutos · Exigida: {Motivo} · {Cadastro} |
| Auditoria: campos do painel | Cadastro · Motivo · Tipo de troca · Validade · Duração (Negócio) · valores: {dd/mm/aaaa} às {hh:mm} † · {N} minutos / 1 minuto † |
| Auditoria: motivos | os do Negócio, inclusive "Senha temporária vencida" na falha de login |
| Sessão encerrada | Sua sessão terminou. Entre de novo para continuar. (E2.01) |

**Evitar nestas telas**, além do que o Negócio lista: "PIN", "código" e "token" para a senha temporária; "Alterar Senha" (o rótulo antigo) no cadastro de outra pessoa; e "usuário" fora da mensagem única do login do E1.04.

### Acessibilidade
- **Semântica:**
  - a T2 tem um `<h1>` visível; a T3 e a T6 têm o título do diálogo;
  - os tópicos da confirmação ficam numa `<ul>`;
  - o rótulo "Senha" da T5 é um `<p>`, porque não há campo, e a senha temporária é um `<p>`, nunca um `input`.
- **Rótulos e descrições:**
  - cada campo tem `Label` com `htmlFor`;
  - o `aria-describedby` do campo junta, nesta ordem, as regras (quando há), a ajuda "Se não lembra a senha atual…" (quando há) e o erro;
  - o campo com erro recebe `aria-invalid="true"`;
  - as regras não ficam dentro do `<label>`, para o nome do campo continuar sendo só "Nova senha".
- **Mostrar senha (P15):** cada botão tem um `aria-label` próprio (tabela de Textos), `aria-pressed` e `aria-controls`. Ele tem 44×44 px e `type="button"`, e o foco volta ao campo depois do toque.
- **Regra ao vivo (P16):** sem `aria-live`, para não anunciar a cada tecla. O "(regra atendida)" em `sr-only` faz parte da descrição e é lido quando o foco chega ao campo.
- **Anúncios:**
  - os erros de campo são lidos quando o foco vai para o primeiro campo com erro;
  - o `Alert` de conexão usa `role="alert"`;
  - o bloqueio da troca recebe o foco e não usa `role="alert"`;
  - "Senha copiada." usa `role="status"`, e os toasts de sucesso também.
- **Senha temporária (P17):** o bloco visual tem `aria-hidden`, a versão soletrada fica em `sr-only`, e a senha não tem `aria-live`. O `translate="no"` impede que a tradução automática do navegador mude a senha.
- **Foco:**
  - T2: no `h1`, ao abrir;
  - T3: em "Senha atual", ao abrir;
  - confirmação da T6: em "Cancelar"; senha temporária: no título; bloqueio: em "Fechar";
  - ao fechar: o ☰, o item do menu ou o botão do cadastro (T3); "Redefinir senha" (T6).
- **Toque:** campos, "Mostrar senha", botões e o item do menu têm 44 px, com pelo menos 8 px entre si (16 px entre "Salvar nova senha" e "Sair", na T2).
- **Sem depender de cor:** a regra ao vivo muda de forma (círculo vazio → círculo com check) e tem texto; os erros têm ícone e texto; "Senha copiada" tem ícone e texto.
- **Contraste, nos dois temas:**
  - `text-muted-foreground` sobre o cartão dá cerca de 4,9:1 no tema claro e 5,1:1 no escuro;
  - o `Alert` `destructive` usa o texto em `text-foreground` (E1.04);
  - a senha temporária usa `text-foreground` sobre `bg-muted`;
  - os ícones da regra ao vivo usam `text-muted-foreground` (círculo vazio) e `text-foreground` (com check), nunca `text-success`, que fica abaixo de 3:1 sobre branco.
- **Zoom e fonte grande:** nada tem altura fixa. Os grupos da senha temporária quebram linha (`flex-wrap`), a T2 rola, e a T3 rola por dentro (P1). Em 320 px e com 200%, nada é cortado.
- **Movimento:** o `Loader2` e as animações dos diálogos levam `motion-reduce:`. A troca para "Senha copiada" não tem animação.

### Critérios de UX
Numeração própria deste spec. Continuam valendo os critérios do E1.04 (UX-01 a UX-19 de lá) e, do E2.01, o UX-35 e o UX-36 (sessão encerrada).

| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | No login, "Esqueceu a senha? Fale com o seu líder." aparece abaixo de "Entrar", num `<p>` sem link nem botão: com a tela vazia, com qualquer coisa digitada e com qualquer mensagem no topo. | teste de componente |
| UX-02 | Os campos de senha do login, da senha inicial e das duas trocas têm `autoCapitalize="none"`, `autoCorrect="off"` e `spellCheck={false}`, também com "Mostrar senha" ligado. Nenhum tem `maxLength`, e colar funciona em todos. | teste de componente |
| UX-03 | Com a marca, abrir `/`, `/members`, `/cells`, `/cell-reports`, `/ministries`, `/roles`, `/events` ou `/login` leva à troca obrigatória, com `replace`, sem menu, sem ☰ e sem nenhum dado daquelas telas no DOM. Sem a marca, `/change-password` leva a `/`. | teste E2E (sessão com e sem a marca) |
| UX-04 | A troca obrigatória mostra o título "Crie uma nova senha", o texto do Negócio, "Nova senha", "Confirmar nova senha", "Salvar nova senha" e "Sair", e não mostra "Senha atual". Ao abrir, o foco está no `h1`. | teste de componente |
| UX-05 | `autoComplete` e `enterKeyHint`: "Senha atual" com `current-password` e `next`; "Nova senha" com `new-password` e `next`; "Confirmar nova senha" com `new-password` e `done`; "Senha inicial (opcional)" com `off`. | teste de componente |
| UX-06 | Enter num campo com algum campo seguinte vazio leva o foco ao primeiro vazio, sem mensagem e sem requisição. Com todos preenchidos, Enter envia. | teste de componente |
| UX-07 | Nas duas trocas, a linha "Use pelo menos 8 caracteres." fica entre o rótulo e o campo "Nova senha". Com 7 caracteres, o ícone é o círculo vazio; com 8, o círculo com check, e o "(regra atendida)" entra para o leitor de tela. A linha não tem `aria-live`. O `aria-describedby` do campo aponta para as regras e, quando há, para o erro. | teste de componente |
| UX-08 | A tela confere, ao sair do campo e ao enviar, e não faz requisição quando encontra um erro:<br>- campos vazios: "Informe a senha atual.", "Informe a nova senha." e "Confirme a nova senha.";<br>- `Abc1234`: "A senha precisa ter pelo menos 8 caracteres.";<br>- a frase de 73 bytes do critério da RN-13: "A senha é longa demais.";<br>- `11111111`, `12345678`, `87654321`, `abcdefgh`, `Senha123` e `igreja@2024`: "Esta senha é fácil de adivinhar. Escolha outra.";<br>- na troca voluntária de Caio, `cpf529.982.247-25`: a mensagem dos dados pessoais;<br>- confirmação diferente: "As senhas não conferem.".<br><br>Cada mensagem fica embaixo do seu campo, uma por campo, na ordem da RN-13. No erro da política, a nova senha e a confirmação são limpas, e o foco vai para "Nova senha". Na confirmação diferente, só a confirmação é limpa e recebe o foco. Nenhuma mensagem aparece a cada tecla. | teste de componente (tabela de casos) |
| UX-09 | Nas duas trocas, as respostas do servidor vão para o lugar certo: a política para "Nova senha", a confirmação para "Confirmar nova senha", a senha atual errada para "Senha atual". Conexão, erro 5xx e tempo-limite mostram o `Alert` de conexão no topo, com os campos mantidos e o foco sem mudança. Nenhum texto do servidor aparece como veio. | teste de componente (respostas simuladas) |
| UX-10 | Ao salvar na troca obrigatória, a tela vai para `/` com `replace`, mostra "Senha alterada. Use a nova senha da próxima vez que entrar." e monta o menu com os itens da função da pessoa. O "voltar" do navegador não volta à troca. | teste E2E |
| UX-11 | "Sair", na troca obrigatória, encerra a sessão e abre o login sem o aviso de sessão encerrada e sem pedir confirmação. Ele tem 44 px de altura e fica a 16 px de "Salvar nova senha". Ao entrar de novo, a pessoa volta à troca. | teste E2E |
| UX-12 | Em 360×800, com o teclado fechado, "Salvar nova senha" fica visível sem rolar na troca obrigatória e no "Alterar minha senha", também com uma mensagem de erro na tela. Em 320×568 não há rolagem horizontal. A troca obrigatória usa `min-h-dvh`. | teste E2E (viewport) |
| UX-13 | Com a sessão de Vera aberta numa lista, a marca posta pela publicação faz a próxima leitura levar à troca obrigatória, sem toast e sem mensagem de erro. | teste E2E (resposta simulada com o código da AQ-3) |
| UX-14 | O menu de Rita, Pedro, Caio e Hugo tem "Alterar minha senha" acima de "Sair", com 44 px de altura no celular. No celular, o toque fecha o menu e abre o diálogo. | teste de componente (`AppSidebar`) |
| UX-15 | No próprio cadastro ("Editar meus dados" de Caio e "Ver meus dados" de Hugo), a seção Acesso tem "Alterar minha senha", que abre o mesmo diálogo. "Redefinir senha" nunca aparece no próprio cadastro. | teste de componente |
| UX-16 | "Alterar minha senha" ocupa a tela abaixo de 768 px (P1) e é um `Dialog` com `max-w-md` a partir de 768 px. A ordem é "Senha atual", regras, "Nova senha" e "Confirmar nova senha", e o foco começa em "Senha atual". | teste E2E (viewport) |
| UX-17 | Senha atual errada: "A senha atual não confere." embaixo do campo, que é limpo e recebe o foco. A nova senha e a confirmação ficam. A partir do primeiro erro, aparece "Se não lembra a senha atual, fale com o seu líder.". | teste de componente |
| UX-18 | Bloqueio da troca:<br>- o `Alert` traz o {N} da resposta, com "1 minuto" no singular;<br>- ele recebe o foco e não tem `role="alert"`;<br>- a senha atual é limpa;<br>- "Salvar nova senha" continua habilitado, sem contagem regressiva;<br>- a mensagem some depois de {N} minutos;<br>- a sessão continua funcionando nas outras telas. | teste de componente (relógio simulado) |
| UX-19 | Na troca voluntária concluída, o diálogo fecha, aparece o toast do Negócio, e o foco volta para o ☰ (celular), para o item do menu (desktop) ou para o botão do cadastro. Ao abrir de novo, os campos estão vazios. | teste de componente + teste E2E |
| UX-20 | "Cancelar", "✕" e `Esc` fecham o "Alterar minha senha" sem pedir confirmação. Durante o envio, nada fecha o diálogo. Depois de fechar, nenhuma senha digitada fica no estado da tela. | teste de componente |
| UX-21 | A linha "Senha" no cadastro de outro membro, com a massa:<br>- André, em Caio: o botão "Redefinir senha";<br>- André, em Lauro: "Este membro não tem acesso ao sistema.", sem botão;<br>- André, em Olga (com a AQ-2): "Você não tem permissão para redefinir a senha deste membro.", sem botão;<br>- uma função com "Editar Membro" e sem "Redefinir Senha de Membros": nem a linha "Senha".<br><br>O botão "Alterar Senha" e o diálogo "Nova Senha" não existem mais. | teste de componente |
| UX-22 | Confirmação: título "Redefinir a senha de Caio Lima?", os quatro tópicos numa lista, "Redefinir senha" (`default`, 44 px) e "Cancelar" (`outline`, 44 px, com o foco inicial). Enquanto envia, aparece "Redefinindo…", os dois botões ficam desabilitados, `Esc` e o toque fora não fecham, e um duplo toque gera um pedido só. | teste de componente |
| UX-23 | Na senha temporária:<br>- o foco vai para o título "Senha temporária de Caio Lima";<br>- a senha fica fora de qualquer `input`, com `translate="no"`, em dois grupos de 4 no visual e com 8 caracteres sem espaço no texto;<br>- uma redefinição em 28/11/2026 às 23:50 mostra "Válida até 05/12/2026 às 23:50." (critério da RN-05), também com o aparelho em outro fuso;<br>- "Ela não será mostrada de novo." está em negrito. | teste de componente (fuso simulado) |
| UX-24 | "Copiar senha" põe exatamente os 8 caracteres na área de transferência, troca o rótulo por "Senha copiada" sem mudar o tamanho do botão e anuncia "Senha copiada." por `role="status"`. Se a cópia falhar, a senha fica selecionada, e aparece a mensagem de falha. | teste de componente (área de transferência simulada) + teste E2E |
| UX-25 | "Compartilhar senha" só aparece com `navigator.share`. Ele compartilha só os 8 caracteres da senha, sem nenhum outro texto (P-SEN-18). Desistir do compartilhamento não mostra erro. | teste de componente |
| UX-26 | Só "Concluir" fecha a senha temporária: `Esc` e o toque fora não fazem nada. Depois de fechar, a senha não está no DOM, no cache do React Query, no `localStorage`, no `sessionStorage`, na URL nem no console, e o foco volta para "Redefinir senha", com "Senha redefinida às {hh:mm}. Não é preciso salvar o cadastro.". | teste de componente + teste E2E |
| UX-27 | Cada recusa da AQ-1 mostra o diálogo de bloqueio, com o título "Não foi possível redefinir a senha", o texto do Negócio e "Fechar", com o foco. "Este cadastro não existe ou já foi excluído." fecha também o cadastro e recarrega a lista. "Você não tem permissão para redefinir senhas." faz a tela reler o acesso. A mensagem do limite traz o {N}, com "1 minuto" no singular. | teste de componente (respostas simuladas) |
| UX-28 | Na redefinição, conexão, erro 5xx e tempo-limite deixam a confirmação aberta, com o `Alert` de conexão (`role="alert"`) e "Redefinir senha" habilitado de novo. Nenhuma senha aparece. | teste de componente |
| UX-29 | Com leitor de tela, a senha temporária é lida caractere por caractere ("Senha: k, 7, m, 2, x, 9, p, a."), o bloco visual é ignorado, e "Senha copiada." é anunciado. | inspeção (leitor de tela) + teste de componente (`sr-only` e `aria-hidden`) |
| UX-30 | No cadastro novo, "Senha inicial (opcional)" fica na seção Acesso, sem placeholder, com "Mostrar senha", `autoComplete="off"` e as duas dicas (a do Negócio e a regra em terceira pessoa) entre o rótulo e o campo, ligadas por `aria-describedby`. Não há "Confirmar senha". Em branco ou com `123456`, o cadastro é salvo sem erro. No Chrome do Android, criar o membro não oferece "Salvar senha?". | teste de componente + inspeção (Chrome do Android) |
| UX-31 | No cadastro novo, a senha inicial `abc12` mostra "A senha precisa ter pelo menos 8 caracteres." embaixo do campo, ao sair dele e ao enviar, com o foco no campo, e nada vai ao servidor. Com o CPF digitado no formulário dentro da senha, a mensagem é "A senha não pode conter o CPF, o celular ou a data de nascimento do membro, nem ser o e-mail do cadastro.". A recusa do servidor aparece no mesmo lugar. | teste de componente |
| UX-32 | Em Funções, "Redefinir Senha de Membros" fica no grupo "Membros", com a dica do Negócio ligada por `aria-describedby`. A Líder mostra "13 permissões". "Alterar Senha de Membros" não aparece no DOM. | teste de componente |
| UX-33 | Na Auditoria, as seis ações aparecem com os rótulos do Negócio na linha, no painel e no filtro, depois de "Logout", na ordem da T8. Cada linha tem a segunda linha da tabela de Textos. O autor é quem fez a ação, e "—" na marca posta pela publicação. | teste de componente |
| UX-34 | No painel desses eventos aparecem "Cadastro", "Motivo", "Tipo de troca", "Validade" e "Duração", só os que têm valor, sem o JSON de "Metadados". Nenhuma senha, hash ou origem aparece. A falha de login com o motivo "Senha temporária vencida" aparece como as outras (T2 do E1.04). | teste de componente |
| UX-35 | Todo "Mostrar senha" deste spec é um botão de 44×44 px, `type="button"`, com o `aria-label` da tabela de Textos e `aria-pressed`. Ele não envia o formulário, devolve o foco ao campo, e a senha volta a ficar oculta a cada envio. | teste de componente |
| UX-36 | Em 320 px, com zoom de 200% e com a fonte grande do sistema, não há rolagem horizontal, a senha temporária quebra entre os grupos sem cortar, e os textos e os botões quebram linha. | teste E2E (viewport) + inspeção |
| UX-37 | Nas telas deste spec, o contraste é de 4,5:1 para texto e de 3:1 para ícones e bordas, nos temas claro e escuro. A regra ao vivo, os erros e "Senha copiada" não dependem só de cor. | inspeção (axe, temas claro e escuro) |
| UX-38 | Nenhum texto visível destas telas tem "resetar", "reset", "password" nem "Alterar Senha" (o rótulo antigo), e nenhuma mensagem técnica aparece. | teste de componente (módulo de textos) |
| UX-39 | Na lista de Membros, quem tem "Redefinir Senha de Membros" vê "Redefinir senha" no "⋯" do card (celular) e nas ações da linha (desktop) dos outros membros com conta, inclusive sem "Editar Membro" (a função Apoio do critério da RN-01). O item não aparece na própria linha nem na de Lauro (sem conta). Ele abre a T6, e, ao fechar, o foco volta para o botão de ações da linha. | teste de componente + teste E2E (viewport) |

### Perguntas para o `architect` (dados e contrato)
Em cada uma, a tela tem um comportamento padrão (o mais conservador) se a resposta for "não".

- **AQ-1. Resposta da redefinição** (T6).
  - Sucesso: a senha temporária e a validade, em data e hora UTC, que a tela mostra em `America/Sao_Paulo`.
  - Recusas com código, além do texto, para a tela escolher o que fazer depois: `no_permission`, `rate_limited` (com os minutos, já arredondados para cima), `not_found` (o mesmo código para fora do que se vê e para excluído), `self`, `role_not_covered` e `no_account`.
  - Erro do servidor e tempo-limite: sugestão de 20 s no cliente, como a AQ-2 do E1.04.
  - Com o `supabase.functions.invoke`, a resposta que não é 2xx vira `FunctionsHttpError`, e a tela precisa ler o status e o corpo.
  - *Padrão sem os códigos:* o bloqueio mostra o texto do servidor, e nada mais acontece: a lista não recarrega, e o acesso não é relido.
- **AQ-2. Saber antes, no cadastro, se a redefinição é possível** (UXD-7). Por membro: `can_reset_password` e o motivo (`self`, `no_account` ou `role_not_covered`), pela mesma regra do servidor, sem o limite. Pode vir da `members_view` (preenchido só para quem tem a permissão) ou de uma RPC por id, chamada ao abrir o cadastro.
  - "Sem conta" a tela já sabe pelo `auth_user_id` do cadastro, e "próprio" pelo `auth_user_id` de quem está logado.
  - *Padrão sem isso:* o botão aparece em todo cadastro de outra pessoa com conta, e a função não coberta só aparece como recusa, depois de confirmar.
- **AQ-3. A marca na tela** (RN-08 a RN-10).
  - A tela lê a marca na sessão que a `sign-in` devolve (`app_metadata.must_change_password`, como nas Dependências do E1.04).
  - RN-09 (c): toda leitura ou gravação recusada por causa da marca precisa de um código próprio (por exemplo, `password_change_required`), diferente do 42501 genérico, nas tabelas, nas views, nas RPCs e nas Edge Functions. O `QueryCache` e o `MutationCache` (E2.01) usam o código para levar à troca sem mensagem. Com o 42501 genérico, a pessoa veria "Você não tem permissão para esta ação.".
  - Depois da troca obrigatória, a sessão do aparelho precisa ficar sem a marca (token renovado, ou devolvido pela função). Senão, o portão manda a pessoa de volta para a troca.
  - Enquanto a marca vale, o `AuthContext` não consegue ler o cadastro nem as permissões (RN-09 b). A leitura recusada não pode ser tratada como "conta sem cadastro", e, depois da troca, a tela relê o acesso (P13).
  - O registro do logout (`log_auth_event`) precisa ser aceito com a marca (critério da RN-09).
  - Rota sugerida: `/change-password`, com o portão no `ProtectedRoute`.
- **AQ-4. Respostas da troca** (obrigatória e voluntária). Códigos, para a tela pôr a mensagem no campo certo:
  - `current_password_invalid` (Senha atual);
  - `change_blocked`, com os minutos (`Alert`);
  - `password_too_short`, `password_too_long`, `password_weak`, `password_personal_data` e `password_same_as_current` (Nova senha);
  - `password_mismatch` (Confirmar nova senha);
  - `not_flagged` (troca sem a senha atual numa conta sem a marca);
  - o erro do servidor e o fim de sessão.
  - *Padrão sem os códigos:* o texto do servidor no `Alert` do topo, sem marcar o campo.
- **AQ-5. Resposta perdida (3G).** O que acontece quando a troca foi gravada, a resposta não chegou, e a pessoa envia de novo:
  - na voluntária, a senha atual já mudou: a pessoa receberia "A senha atual não confere." e gastaria um dos 5 erros (RN-12). Sugestão: uma chave por envio, que a tela gera ao abrir o diálogo e repete nos reenvios. Se a troca com essa chave já foi feita, a resposta é o sucesso;
  - na obrigatória, `not_flagged` na mesma sessão quer dizer que a troca já foi feita, porque uma troca em outro aparelho teria encerrado esta sessão. A tela trata como sucesso e segue para `/`. Confirmar;
  - na redefinição, o reenvio gera outra senha e invalida a perdida (RN-04). Nada a fazer.
  - *Padrão sem a chave:* a mensagem da senha atual, como hoje.
- **AQ-6. Política num ponto só** (ponto 3 de "Pontos para o `architect`"). A tela confere, sem o servidor, o tamanho, a repetição, a sequência, as palavras do contexto e, quando tem os dados, os dados pessoais (UX-08). Para não divergir do servidor:
  - um módulo com essas regras, usado pela tela e pelas funções, ou as duas implementações passando pela mesma tabela de casos (critérios da RN-13 e UX-08);
  - a lista de senhas comuns (e) fica só no servidor, por causa do tamanho;
  - a contagem dos "8 caracteres" (sugestão: pontos de código, como `Array.from`) e dos 72 bytes (UTF-8, `TextEncoder`) precisa ser igual nos dois lados;
  - na troca voluntária, a tela usa os dados do próprio cadastro (`AuthContext`). Na obrigatória, ela não os tem (RN-09 b), e só o servidor confere.
- **AQ-7. Auditoria** (T8):
  - os valores de `events.action` dos seis eventos, para o rótulo e o filtro;
  - a `entity` deles. Se for `auth`, o painel da T2 do E1.04 vale como está; se for `member`, a tela aplica a mesma leitura a esses eventos;
  - chaves estáveis para o motivo, o tipo de troca, a validade (data e hora em UTC) e a duração (minutos);
  - o autor (quem redefiniu ou tentou; o próprio membro na troca, na falha, no bloqueio e na marca do login; ninguém na marca da publicação) e o cadastro no `entity_label` (o nome do alvo ou do próprio membro).
- **AQ-8. Senha inicial no cadastro** (T5). A `create-user-admin`, ou o caminho que a substituir, confere a política com os dados enviados no formulário e recusa com os códigos da AQ-4 e o campo `password`, sem fechar o formulário. A `123456` exata vale como vazio (RN-07).
- **AQ-9. Testes E2E.** O `getByLabel("Nova senha")` sem `exact` acha também "Confirmar nova senha" e o botão "Mostrar nova senha". Os testes usam `{ exact: true }`, como na AQ-7 do E1.04.

### Pendências para o PO (resolvidas em 2026-11-23)
Nenhuma bloqueava o desenho. O PO resolveu todas em 2026-11-23. As decisões estão em "Negócio > Decisões > Padrões definidos por este spec" (P-SEN-18 a P-SEN-25), nas RNs e em "Textos de tela". **Revisar no PR.**

- **PO-UX-1. "Compartilhar senha", com mensagem pronta** (UXD-4, T6).
  - *Adotado:* o botão aparece quando o aparelho oferece o compartilhamento e leva a mensagem da tabela de Textos: saudação, a senha numa linha própria, a validade e o endereço do sistema. Não leva CPF, celular nem e-mail do membro. O sistema não envia nada: quem escolhe o contato é o líder (RN-03).
  - *Atenção:* se o membro copiar a mensagem inteira e colar no campo de senha, o login falha, e a tentativa conta para o bloqueio (RN-10 do E1.04). A senha numa linha própria ajuda, mas não impede.
  - *Alternativas:* compartilhar só a senha (colar a mensagem inteira funciona, mas ela chega sem explicação); ou não ter o botão, só "Copiar senha".
  - ***Resolvida (PO): "Compartilhar senha" fica, mas leva só a senha** (P-SEN-18).*
    - *Motivo: é a opção mais segura. O membro que copiar tudo o que recebeu e colar no campo de senha entra, sem gastar uma das 5 tentativas (RN-10 do E1.04). A mensagem também deixa de ter o formato "senha + endereço do sistema", que um golpe poderia imitar com outro endereço.*
    - *A explicação vai na conversa, escrita pelo líder, e a tela da senha temporária já diz a ele o que dizer ("{Primeiro nome} entra com o CPF, o celular ou o e-mail do cadastro e esta senha…").*
    - *Não ter o botão não seria mais seguro: o conteúdo seria o mesmo do "Copiar senha", com mais passos.*
    - *No Negócio, mudaram a RN-03, o critério dela e os Textos de tela. Na UX, a UXD-4, o "Compartilhar senha" da T6, a linha "Texto compartilhado" de Textos e o UX-25.*
- **PO-UX-2. "Alterar minha senha" também no próprio cadastro** (UXD-6). O Negócio fala só do menu. A UX repetiu o botão na seção Acesso do próprio cadastro, onde o legado tinha a senha.
  - *Adotado.* Não muda nenhuma regra: o diálogo é o mesmo.
  - ***Resolvida (PO):** aceito (P-SEN-19). A RN-11 passou a citar os dois lugares e ganhou um critério para "Editar meus dados" e "Ver meus dados".*
- **PO-UX-3. Quem tem "Redefinir Senha de Membros" sem "Editar Membro" não alcança a ação.** A redefinição fica no cadastro do membro, que só abre para edição com "Editar Membro". Nas funções semeadas não há problema: a Líder e a Administrador têm as duas. Mas uma função criada na tela só com "Redefinir Senha de Membros" não acharia a ação, apesar da RN-01.
  - *Adotado (conservador):* só no cadastro, como pedido.
  - *Proposta:* "Redefinir senha" também no "⋯" do card de Membros (celular) e nas ações da linha (desktop), para quem tem a permissão. Isso também encurta o F1, porque o líder não rola o cadastro nem precisa fechá-lo depois. Se for aceita, a UX detalha na revisão.
  - *Alternativa:* a dica da permissão em Funções avisar que ela precisa de "Editar Membro". Muda o texto do Negócio.
  - ***Resolvida (PO): a proposta foi adotada** (P-SEN-20).*
    - *Motivo: a RN-01 dá o direito pela permissão, e não pela tela de edição. Uma função com "Redefinir Senha de Membros" sem "Editar Membro" faz sentido (por exemplo, quem só dá suporte de acesso), e o F1 fica mais curto.*
    - *O item na lista segue a RN-02 como no cadastro; os motivos de recusa previsíveis continuam aparecendo como texto no cadastro (UXD-7).*
    - *No Negócio, mudaram a RN-01, os critérios dela e a linha "Ação" dos Textos de tela. Na UX, a linha nova em "O que muda", o item "Lista de Membros" na T5 e o UX-39, que é novo, sem wireframe próprio. O `ux-designer` pode revisar.*
- **PO-UX-4. Senha inicial no cadastro** (UXD-8):
  - o campo vai de "Dados Pessoais" para "Acesso", com o rótulo "Senha inicial (opcional)";
  - não tem "Confirmar senha" (o legado tinha), e sim "Mostrar senha";
  - a regra e o erro dos dados pessoais falam do membro: "…e não use o CPF, o celular ou a data de nascimento do membro." e "A senha não pode conter o CPF, o celular ou a data de nascimento do membro, nem ser o e-mail do cadastro.". Os textos do Negócio, com "o seu CPF", falariam do CPF de quem cadastra.
  - *Adotado.* O sentido das regras não muda.
  - ***Resolvida (PO):** aceito (P-SEN-21).*
    - *Sem "Confirmar senha", um erro de digitação faz o membro não entrar com a senha combinada; "Mostrar senha" reduz esse risco, e o caminho é a redefinição (RN-04). O padrão mais comum, deixar em branco, não tem esse risco.*
    - *No Negócio, mudaram a RN-07 (local, nome do campo e textos sobre o membro), a RN-13 ("onde vale"), o critério da RN-07 e os Textos de tela, que ganharam a regra e o erro em terceira pessoa.*
- **PO-UX-5. "Concluir" fecha a senha temporária sem pedir confirmação, mesmo sem copiar** (UXD-5). `Esc` e o toque fora não fecham.
  - *Adotado.* Se o líder fechar antes de passar a senha, ele redefine de novo, e a anterior deixa de valer (RN-04).
  - *Alternativa:* perguntar "Concluir sem copiar a senha?" quando ela não foi copiada nem compartilhada. Protege o engano, mas acrescenta um toque justamente quando o membro está ao lado e digita olhando a tela.
  - ***Resolvida (PO):** aceito (P-SEN-22). Fechar sem copiar não tem risco de segurança: a senha some, e uma nova redefinição invalida a anterior (RN-04). A RN-03 passou a dizer isso e ganhou critérios.*
- **PO-UX-6. Ajuda depois do primeiro erro da senha atual:** "Se não lembra a senha atual, fale com o seu líder." (T3). É o caminho da RN-15 aplicado à troca voluntária, para quem está conectado e esqueceu a senha.
  - *Adotado.*
  - ***Resolvida (PO):** aceito (P-SEN-23). A RN-11, o critério dela e os Textos de tela passaram a ter o texto. Ele não revela nada: a pessoa está conectada e só vê a própria conta.*
- **PO-UX-7. Ciência: a marca posta durante o uso** (RN-09 c, F12). A tela leva à troca sem aviso, e o que a pessoa estava digitando (por exemplo, um relatório) se perde. Depois da troca, ela vai para a tela inicial (RN-10), e não para a tela em que estava. Isso acontece uma vez, na publicação (RN-08 c).
  - *Adotado como está,* sem mudança nas RNs.
  - ***Resolvida (PO):** ciente e aceito, sem mudança nas RNs (P-SEN-24).*
    - *Guardar o que estava sendo digitado, ou voltar para a mesma tela depois da troca, custaria mais do que vale para algo que acontece uma vez.*
    - *Para reduzir o efeito, a publicação deste passo é feita fora das noites de célula, quando os relatórios são lançados. Isso entrou em "Impactos em outros passos" (Deploy).*
- **PO-UX-8. Textos definidos pela UX** (marcados com † em Textos):
  - "Salvando…" e "Redefinindo…";
  - o toast da troca obrigatória;
  - os campos vazios;
  - "(regra atendida)" e os rótulos dos botões "Mostrar…";
  - "Senha" e "Senha inicial (opcional)" no cadastro, e "Senha redefinida às {hh:mm}. Não é preciso salvar o cadastro.";
  - na confirmação e na senha temporária, o primeiro nome no corpo (o nome completo continua no título) e "conectado" ou "conectada" conforme o gênero;
  - "Só letras minúsculas e números.", a senha soletrada para o leitor de tela e a mensagem de cópia que falhou;
  - o título "Não foi possível redefinir a senha" nas recusas;
  - a segunda linha da Auditoria e os formatos da validade e da duração.
  - *Adotados.*
  - ***Resolvida (PO):** aceitos (P-SEN-25) e copiados para os Textos de tela do Negócio: "Salvando…", "Redefinindo…", o toast da troca obrigatória, os campos vazios, "Senha inicial (opcional)", "Senha redefinida às {hh:mm}…", o primeiro nome e o gênero na confirmação, "Só letras minúsculas e números.", a cópia que falhou e o título das recusas. A segunda linha da Auditoria e os formatos ficam referenciados na Experiência (UX). "(regra atendida)", os rótulos dos botões "Mostrar…" e a senha soletrada são só para leitor de tela e ficam na UX.*

## Solução técnica
_Seção do `architect`. Escrita em 2026-11-23, só como desenho: nada foi implementado. **A implementação começa depois do E1.04, do E2.01 e do E2.02 inteiros em produção** (ver [Implantação](#implantação))._

_O desenho parte do estado final dos três specs e usa os nomes definidos lá:_
- _E1.04: `sign_in_attempt`, `sign_in_record_login`, `private.sign_in_throttle`, `private.sign_in_key`, `private.sign_in_origin_key`, o `supabase/functions/sign-in/lib/client-ip.ts`, o `EDGE_FUNCTIONS_REMOVED` do workflow e os módulos `src/lib/auth/{session,sign-in-result}.ts` e `src/lib/audit/auth-events.ts`;_
- _E2.01: `private.member_access_suspensions`, `_del_suspend_access`, `_del_resume_access`, `_del_raise`, `normalize_digits`, `parseAppError` (`src/lib/errors.ts`) e o `QueryCache`/`MutationCache` com o `shouldEndSession`;_
- _E2.02: `viewer_member_id`, `viewer_has`, `user_has_permission` restrita, `viewer_sees_member`, `viewer_covers_role`, `default_role_id`, `my_access`, `is_admin` (só `service_role`), as colunas da `members_view` e `src/lib/access/*`._

_Se algum desses nomes ou assinaturas mudar na implementação de lá, a tarefa 1 volta ao `architect`._

_Conferido em 2026-11-23:_
- _no código do Supabase Auth ([`supabase/auth`](https://github.com/supabase/auth), `master`):_
  - _`internal/api/user.go` (`UserUpdate`): a força da senha é conferida antes de tudo; depois vêm a reautenticação, a senha atual e a "mesma senha", as duas últimas só quando `user.HasPassword()`; a gravação fica dentro de `db.Transaction`;_
  - _`internal/models/user.go`: `UpdatePassword`, `SoftDeleteUser` (grava nulo) e `ReEncryptPassword`;_
  - _`internal/api/auth.go` (`maybeLoadUserOrSession`): o token cuja sessão foi apagada recebe 403 `session_not_found`;_
- _nas docs do Supabase: [Password security](https://supabase.com/docs/guides/auth/password-security) ("Require reauthentication…", "Require current password…" e senhas vazadas só no Pro), [Rate limits](https://supabase.com/docs/guides/auth/rate-limits), a [configuração do Auth pela Management API](https://supabase.com/docs/reference/api/v1-update-auth-service-config) e o [aviso de 21/04/2025 sobre os schemas `auth`, `storage` e `realtime`](https://supabase.com/changelog/34270-restricting-access-on-auth-storage-and-realtime-schemas-on-april-21-2025), que mantém os triggers em `auth.users` e `auth.sessions`;_
- _na stack local `supabase_db_mci-e108-pr2`, só com leitura:_
  - _`auth.jwt()` e `auth.uid()`; as colunas de `auth.sessions` e `auth.refresh_tokens`;_
  - _o dono de `auth.users` (`supabase_auth_admin`) e o privilégio `TRIGGER` do `postgres` nela;_
  - _o formato `$2a$10$` do `crypt` do `pgcrypto` e o `gen_random_bytes`;_
  - _o `_log_event` (aceita `_actor_user_id`), os enums `event_action` e `event_entity` e o `viewer_has`;_
  - _o locale (ICU, `en_US.UTF-8`) e os parâmetros de log (`log_min_duration_statement = -1`, `log_parameter_max_length = -1` e `log_parameter_max_length_on_error = 0`);_
- _no `mci-connect`:_
  - _`origin/main` (`bef0877`): `change-member-password`, `create-user-admin`, `AuthContext.tsx`, `App.tsx`, `MemberForm.tsx`, `errors.ts`, `config.toml` e `deploy-banco.yml`;_
  - _a branch `feat/E2.01-pr1-banco` (migration `e201_03_read`: `user_has_permission`, `viewer_member_id`, `viewer_covers_role` e `log_auth_event`) e os testes pgTAP dela, que entram como usuário só com `sub` e `role` nas *claims*._

### Revisão das regras
Nenhuma RN precisou voltar ao PO. As lacunas técnicas foram resolvidas pela leitura mais conservadora e estão em [Definidas pelo architect](#definidas-pelo-architect-revisar-no-pr).

Casos de borda conferidos:
- **Fuso e virada de semana:** nenhum prazo deste passo depende de data.
  - A validade (168 horas), as janelas dos limites (60 e 15 minutos) e os bloqueios são `timestamptz` comparados com `clock_timestamp()` depois das travas.
  - A tela só converte para `America/Sao_Paulo` na hora de mostrar.
  - O Brasil não tem horário de verão desde 2019. Se voltar a ter, a validade continua em horas corridas (RN-05).
- **Casal:** o cônjuge é alvo como qualquer membro visível, pela regra do E2.02 (`viewer_sees_member`). André redefine a senha de Beatriz, de outro ministério, porque o cônjuge é âncora do escopo dele.
- **Inativo, pastor, sem liderança, sem função:**
  - nada no caminho olha `is_active`, `is_pastor` ou `leader_id`;
  - o alvo sem função é coberto por todos (`viewer_covers_role(NULL)` é verdadeiro);
  - a troca da própria senha não passa por `viewer_has`, então Hugo, sem função, troca a dele.
- **Excluído:**
  - a redefinição trava o cadastro com `FOR KEY SHARE` e relê `deleted_at` depois da trava, por causa da corrida com `delete_member`. A conta suspensa não é tocada;
  - o cofre (DT-01) guarda a senha e a marca durante a exclusão. A restauração as devolve sem nenhuma mudança no E2.01 (RN-08, RN-16 f do E2.01).
- **Sem conta:** `auth_user_id` nulo, ou conta apagada, banida, não confirmada, SSO ou anônima: "Sem conta de acesso" (DA-3).
- **Consolidado (futuro):** não tem conta, então cai em "Sem conta de acesso".
- **Concorrência e volume:** ver [Bloqueios e concorrência](#bloqueios-e-concorrência) e [Riscos](#riscos-concorrência-escala-segurança).

Leituras técnicas. Nenhuma muda regra, mas o PO e o QA precisam saber delas:
1. **A senha sai do Auth (DT-01).** O hash passa a morar num cofre do banco, e o Auth fica sem senha nenhuma. É o que fecha a RN-14 sem deixar um oráculo de senha ([Avaliação da RN-14](#avaliação-da-rn-14-caminho-único)). Para o usuário, nada muda.
2. **"Erro de permissão, ou uma resposta vazia" (RN-09).** A leitura de uma tabela vazia não chega a avaliar a política, então volta vazia, sem erro. O critério já aceita isso. A tela não depende do erro: ela sabe da marca pela `sign-in` e por `my_password_status()`.
3. **"Sair" encerra os outros aparelhos na hora.**
   - O `signOut()` do supabase-js usa o escopo global por padrão, e o Auth apaga todas as sessões da pessoa. Hoje os outros aparelhos seguem até o token expirar (até 1 hora).
   - Com o portão (DT-04), a próxima ação neles já leva ao login com o aviso de sessão encerrada.
   - Não é regra nova, mas passa a ser visível. Se o PO preferir que "Sair" encerre só o aparelho, basta `signOut({ scope: 'local' })`, fora deste passo.
4. **O painel do Supabase e a Admin API deixam de trocar senha** (DA-12). Os scripts da migração não são afetados: eles criam contas sem senha (E4.08).
5. **A redefinição é uma RPC, e não uma Edge Function** (DA-10). Quem entra na lista `EDGE_FUNCTIONS` é a `change-own-password`, das trocas. A `change-member-password` sai.
6. **Entre o PR 1 e o PR 4, a RN-09 vale só na tela.** O portão só é ligado no PR 4, depois que o front que trata a marca estiver no ar ([Implantação](#implantação)). Ligar antes trancaria quem tem a marca num front que não sabe levar à troca.
7. **A resposta de sucesso da `sign-in` ganha `must_change_password`.** Ela continua sem o objeto `user` do Auth (RN-13 do E1.04).
8. **"Senha alterada" de antes.** Os eventos `password_changed` gravados pela `change-member-password` (redefinição pelo administrador, entidade `member`) ficam como estão. Os novos são da troca pelo próprio membro, com a entidade `auth` (AQ-7). Em produção, a função nunca foi publicada, então não deve haver nenhum.

#### Definidas pelo architect (revisar no PR)
Pontos que as RNs não respondem por inteiro. O `architect` adotou a leitura mais conservadora. O usuário pode mudar qualquer um no PR.

| # | Ponto | Padrão adotado | Por quê |
|---|---|---|---|
| DA-1 | Redefinição de um id que não existe (só pela API) | Recusa "Este cadastro não existe ou já foi excluído." (`not_found`). A Auditoria registra o motivo "Fora do que a pessoa vê", sem alvo. | A RN-17 (b) não tem um motivo "inexistente", e o inexistente é tratado como fora do que a pessoa vê (RN-02 a). |
| DA-2 | Alvo excluído e fora do que a pessoa vê | O motivo na Auditoria é "Cadastro excluído". | É o fato mais forte, e a Auditoria só é lida por quem já vê tudo. A resposta é a mesma nos dois casos. |
| DA-3 | O que é "ter conta de acesso" (RN-02 e) | A conta existe em `auth.users`, não foi apagada pelo Auth, tem o e-mail confirmado, não está banida e não é SSO nem anônima. Fora disso, "Sem conta de acesso". | São as condições em que a `sign-in` aceitaria a senha temporária (RN-06 do E1.04). Redefinir a senha de quem não consegue entrar não serve para nada. |
| DA-4 | Maiúsculas e acentos nas regras (c) a (f) da RN-13 | As quatro comparam a forma dobrada da senha: letras ASCII em minúsculas e as letras acentuadas do português sem acento. A (e) também ignora acentos, o que a deixa um pouco mais rígida. | Uma forma só nas duas implementações (tela e banco), sem depender do locale do banco. A RN-13 pede "sem diferenciar maiúsculas" em (e) e "nem acentos" em (f). |
| DA-5 | Sequência de números (RN-13 d) | A sequência dá a volta no 9: `34567890` e `90123456` são sequências. As de letras não dão a volta. | É a ordem do teclado. Recusa um pouco mais, e só senhas fracas. |
| DA-6 | Dados pessoais (RN-13 g) | O CPF só é conferido quando o cadastro tem exatamente 11 dígitos. O celular é conferido pelos 8 últimos dígitos quando há pelo menos 8. O e-mail fictício também conta. | "O dado que o cadastro não tem não é conferido." Conferir o e-mail fictício não recusa ninguém na prática e evita levar a lista de domínios fictícios para a tela. |
| DA-7 | Ordem das conferências da senha nova no servidor | Política (a a g), depois "diferente da atual" (h), depois a confirmação. | A tela confere a confirmação antes de enviar. Pela API, a mensagem mais útil vem primeiro. |
| DA-8 | Erro da senha atual que leva a origem ao limite de falhas (50 desde o E1.04 PR 1b; o desenho original dizia 20) | O bloqueio da origem é registrado como `login_blocked` (escopo origem), como no E1.04. | O bloqueio da origem também barra o login (RN-11 do E1.04), e quem audita precisa ver por quê. |
| DA-9 | Token sem a *claim* `session_id` | O portão não confere a sessão; confere só a marca. | Todo token emitido pelo Auth tem `session_id`. Sem ele, só um token assinado com a chave do projeto, que já é a chave de tudo. Os testes de banco existentes entram só com `sub` e `role`. |
| DA-10 | Onde fica a redefinição | Uma RPC (`reset_member_password`), publicada pelas migrations. A `change-member-password` sai (`EDGE_FUNCTIONS_REMOVED`). A lista `EDGE_FUNCTIONS` ganha a `change-own-password`, das trocas. | A RPC usa a sessão de quem chama (escopo, função e portão) e grava a senha, a marca, as sessões e a Auditoria numa transação só (DT-03). |
| DA-11 | Onde fica a marca | No cofre (`private.account_passwords.must_change`), e não no `app_metadata`. A tela sabe dela pela resposta da `sign-in`, por `my_password_status()` e pelo código do portão. | O `app_metadata` também é gravado pelo próprio Auth, com risco de uma gravação apagar a outra. E a marca no token só muda quando ele é renovado. |
| DA-12 | Troca de senha pelo operador | O painel do Supabase e a Admin API não trocam mais senha. O caminho é a redefinição pelo app ou, numa emergência, o editor SQL como `postgres` chamando `private.write_password`. | É consequência da guarda que fecha a RN-14. A RN-14 diz que a operação não é caminho de uso. |
| DA-13 | Reenvio da troca depois de uma resposta perdida (AQ-5) | Vale como sucesso, sem contar nem registrar de novo, só quando são a mesma sessão, a mesma chave do envio e a mesma senha nova. | Com outra senha nova, responder "sucesso" faria a pessoa acreditar numa senha que não vale. |
| DA-14 | `not_flagged` na troca obrigatória | A tela relê `my_password_status()`. Sem a marca, vai para `/` sem o toast de sucesso. | Na mesma sessão, `not_flagged` quer dizer que uma troca já foi feita daqui. Uma troca em outro aparelho teria encerrado esta sessão. |
| DA-15 | Bloqueio da redefinição sob muitas chamadas | A espera pela trava vai até 5 segundos. Passou disso, a redefinição é recusada com o erro de conexão (RN-06). | 25 chamadas ao mesmo tempo, cada uma com um bcrypt, passam em fila em cerca de 2 segundos. |
| DA-16 | Senha antiga fraca do legado (E3.02, ponto 10 do pedido) | A primeira entrada grava a senha antiga como foi digitada, mesmo fora da política, e põe a marca. A credencial legada é apagada na mesma transação. | Na entrada seguinte com a mesma senha, a pessoa passa pelo caminho normal e volta à troca obrigatória (Impactos do PO). Com uma senha aleatória, ela perderia o acesso. |

### Avaliação da RN-14 (caminho único)
O problema: com o provedor de e-mail desligado (DT-01 do E1.04), o `PUT /user` do Auth continua aceitando a troca de senha com a sessão do próprio usuário, sem senha atual, sem a política, sem os limites e sem a Auditoria.

| Opção | No plano gratuito? | Resultado |
|---|---|---|
| Hook *Password Verification Attempt* | Não (Team e Enterprise) | Só roda no login, não na troca. Fora. |
| Hook *Custom Access Token* | Sim | Roda na emissão do token, não na troca. Fora. |
| "Require reauthentication when changing password" (`security_update_password_require_reauthentication`) | Sim | Só pede o código de reautenticação quando a sessão tem mais de 24 horas (`user.go`). Antes disso, a troca passa sem política, limite nem Auditoria. Insuficiente. |
| "Require current password when changing password" (`security_update_password_require_current_password`) | Sim | O Auth confere a senha atual sem os limites da RN-12. Vira um oráculo de senha. Descartada; fica desligada. |
| Mínimo de senha do Auth acima de 72 | Depende da validação da API | Recusaria toda troca, mas também o `123456` do cadastro (D11). Descartada. |
| Trigger em `auth.users` que recusa a senha gravada pelo Auth | Sim (o aviso de 21/04/2025 mantém triggers em `auth.users`) | Recusa a troca, **mas sozinho deixa um oráculo.** Antes de gravar, o `PUT /user` compara a senha nova com a atual e responde `same_password` quando são iguais (`user.go`, só com `user.HasPassword()`). Quem tem a sessão testaria a senha atual sem os limites da RN-12. O limite do Auth para `/user` é de 30 pedidos a cada 5 minutos por IP. |
| Conferir a senha só no login seguinte (RN-08 b) | Sim | É o mínimo que o PO aceitaria, mas a troca, a Auditoria e os limites ficariam contornáveis. Fica só como rede de segurança. |
| **Senha fora do Auth (cofre no banco) mais o trigger** | Sim | **Adotada (DT-01, DT-02).** Sem hash no Auth, `HasPassword()` é falso: o Auth não confere a senha atual nem a "mesma senha", e a gravação é recusada pelo trigger. Não sobra oráculo. |

**Como a opção adotada funciona:**
- O hash bcrypt de cada conta fica em `private.account_passwords.password_hash`. `auth.users.encrypted_password` fica sempre nulo.
- **Quem confere a senha é o banco:** a `sign_in_attempt` do E1.04 passa a ler o cofre (DT-11). Ela já conferia a senha no banco, com `extensions.crypt` (DT-02 do E1.04).
- **Quem grava a senha é o banco:** `private.write_password`, chamada só pelas RPCs deste passo e, no futuro, pelas do E3.02 e do E1.07.
- O trigger `e203_guard_password_write` (`BEFORE INSERT OR UPDATE OF encrypted_password ON auth.users`) recusa qualquer valor não vazio gravado com `session_user = 'supabase_auth_admin'`, que é o papel com que o Auth se conecta ao banco. Isso pega: _(PR 1: na criação da conta a senha é descartada, e não recusada; ver DT-02.)_
  - o `PUT /user`, a troca pela sessão do próprio usuário;
  - a Admin API (`updateUserById` e `createUser` com senha), inclusive pelo painel.
- Limpar a senha (nulo ou vazio) continua permitido, porque não dá acesso a ninguém. É o que fazem a exclusão do próprio Auth e a `_del_suspend_access` do E2.01.
- O `PUT /user` com `password` recebe um erro do banco (500), e a transação do Auth volta inteira: a senha, as sessões e os códigos de uso único ficam como estavam.
- A política do próprio Auth deixa de ser usada e fica como está (mínimo de 6). Nenhuma configuração do Auth muda neste passo.
- **Efeito a mais:** se a DT-01 do E1.04 for revista e o provedor de e-mail voltar a ser ligado, o login por senha direto no Auth continua falhando para todos, porque o Auth não tem hash (ponto 10 do PO).

**O que fica de fora:**
- **Operação:** o painel e a Admin API não trocam mais senha (DA-12).
- **Mudança de papel do Auth:** a guarda depende de o Auth se conectar como `supabase_auth_admin`. Se isso mudar, ela deixa de recusar.
  - Mesmo assim, o login continua só pelo cofre, então uma senha gravada no Auth não abre nada pela `sign-in`.
  - O "Deploy: banco" confere a cada execução que nenhuma conta tem senha no Auth e que a guarda existe (DT-19), o que pega o caso.
- **Recuperação padrão** (`/recover`): continua dependendo da DT-01 do E1.04 (RN-15). Se o provedor voltar a ser ligado, o Auth enviaria o e-mail, mas a troca pelo link seria recusada pela guarda.
- **Contas criadas fora do app com senha** (por exemplo, pelo painel): o Auth recusa. As contas da carga (E4.08) nascem sem senha.

### Visão geral
```
Redefinição (RN-01 a RN-06)
Tela ─ supabase.rpc('reset_member_password', { _member_id }) (sessão de quem redefine) ─▶ RPC definer, uma transação:
  portão → permissão → limite (trava) → alvo (trava; excluído? visível?) → próprio → função → conta
  → senha temporária → cofre (hash, marca, validade) → apaga as sessões do alvo → conta no limite → Auditoria
  ◀─ { result: 'ok', password, expires_at, reset_at } | { result: 'refused', code, message, retry_after_minutes? }

Troca obrigatória e voluntária (RN-10 a RN-12)
Tela ─ POST /functions/v1/change-own-password (Bearer da sessão) ─▶ change-own-password (Edge Function)
  1. auth.getUser(token): sessão viva, senão 401 session_ended; session_id do token
  2. origem do cabeçalho confiável (_shared/client-ip.ts, DT-06 do E1.04)
  3. rpc change_own_password(...) com a chave secreta ← uma transação:
       travas (origem, conta) → conta e sessão → reenvio? → marca ou senha atual (limites)
       → política → cofre → tira a marca → apaga as outras sessões → zera a conta → Auditoria
  ◀─ 200 ok | 400 invalid | 401 session_ended | 403 not_flagged | 422 current_password_invalid | 429 change_blocked

Login (E1.04): sign_in_attempt lê o cofre; temporária vencida = falha com motivo próprio;
               senha fora da política = marca ◀─ 200 { result: 'ok', session, must_change_password }

Toda leitura e gravação pela API, a partir do PR 4:
  viewer_member_id() e viewer_has() → portão: a sessão do token existe? a conta tem a marca?
  → 42501 + app_error { code: 'session_ended' | 'password_change_required' }
```

Seis partes:
1. **Cofre e política no banco:** a senha, a marca e a validade ficam em `private.account_passwords`. A política tem um ponto único no servidor e uma gêmea na tela, conferidas pela mesma tabela de casos.
2. **Guarda em `auth.users`:** o Auth não grava senha (RN-14).
3. **Redefinição:** uma RPC com a sessão de quem redefine.
4. **Trocas:** a Edge Function `change-own-password`, que descobre a sessão e a origem, mais uma RPC só para a chave secreta.
5. **Login:** a `sign_in_attempt` lê o cofre, recusa a temporária vencida e põe a marca.
6. **Portão:** a sessão encerrada e a marca valem na hora, nas funções de identidade que todo o RLS já usa (o mesmo ponto único do E2.01).

### Modelo de dados e migrations

#### Ordem das migrations
Os nomes são sugestões; o timestamp é o do momento da criação.
- Cada arquivo é idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS` antes de `CREATE TRIGGER`, `DO` com guarda) e roda num banco zerado depois das migrations do E1.04, do E2.01 e do E2.02.
- Depois de cada PR com migration, regenere o `types.ts`.

| # | PR | Arquivo | Conteúdo | Por que separado |
|---|---|---|---|---|
| 1 | 1 | `<ts>_e203_01_enum.sql` | `event_action` ganha `password_reset`, `password_reset_refused`, `password_change_failed`, `password_change_blocked` e `password_change_required` | Um valor novo de enum não pode ser usado na transação que o cria |
| 2 | 1 | `<ts>_e203_02_policy.sql` | Guarda de pré-requisito; `private.common_passwords` e a carga da lista; `private.fold_password`, `private.is_simple_sequence`, `private.password_policy_violation`, `private.generate_temporary_password`; `public.check_password_policy` | Funções puras, sem mudar comportamento. A lista é grande e fica fácil de revisar à parte |
| 3 | 1 | `<ts>_e203_03_vault.sql` | `private.account_passwords`; funções internas (`write_password`, `set_must_change`, `end_sessions`, `usable_account`, `discard_legacy_credential`, `raise_gate`, `assert_session_alive`, `assert_no_password_mark`, os limites); novos tipos no `private.sign_in_throttle`; `sign_in_attempt` lendo o cofre (DT-11); a mudança dos hashes para o cofre; a guarda em `auth.users` | A troca do lugar da senha acontece numa transação só: a `sign_in_attempt` passa a ler o cofre no mesmo *commit* em que os hashes mudam de lugar |
| 4 | 1 | `<ts>_e203_04_rpcs.sql` | `reset_member_password`, `change_own_password`, `set_initial_password`, `my_password_status`; `members_view.password_reset_status`; grants | Revisão do que a tela e as funções chamam |
| 5 | 4 | `<ts>_e203_05_gate.sql` | Portão ligado em `viewer_member_id`, `viewer_has` e `default_role_id`; a Líder com `change_member_password`; marca na publicação (RN-08 c) com a Auditoria; `DROP FUNCTION public.is_admin(uuid)` se nada mais a usar | Só depois do front que trata a marca promovido ([Implantação](#implantação)) |

#### DDL de referência (migrations 2 e 3)
```sql
-- 0. Pré-requisitos: E1.04, E2.01 e E2.02 em produção. Falha cedo, sem mudar nada.
DO $$ BEGIN
  IF to_regclass('private.sign_in_throttle') IS NULL
     OR to_regprocedure('public.sign_in_attempt(text,text,text)') IS NULL
     OR to_regprocedure('private.sign_in_key(text,text)') IS NULL
     OR to_regclass('private.member_access_suspensions') IS NULL
     OR to_regprocedure('public.viewer_sees_member(uuid)') IS NULL
     OR to_regprocedure('public.my_access()') IS NULL THEN
    RAISE EXCEPTION 'E2.03 depende do E1.04, do E2.01 e do E2.02 em produção.';
  END IF;
END $$;

-- 1. Cofre de senhas (DT-01). Uma linha por conta de acesso. Nada disso sai pela API.
CREATE TABLE IF NOT EXISTS private.account_passwords (
  auth_user_id           uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  password_hash          text CHECK (password_hash IS NULL OR password_hash ~ '^\$2[aby]\$[0-9]{2}\$'),
  password_set_at        timestamptz,
  password_set_by        uuid REFERENCES public.members (id),   -- nulo: migração, carga ou o próprio sistema
  must_change            boolean NOT NULL DEFAULT false,        -- a marca (RN-08)
  must_change_reason     text CHECK (must_change_reason IN ('initial', 'reset', 'weak_password', 'legacy_weak')),
  must_change_since      timestamptz,
  temp_expires_at        timestamptz,                           -- só da redefinição (RN-05)
  last_change_session_id uuid,                                  -- reenvio da troca (AQ-5, DA-13)
  last_change_request_id uuid,
  CHECK (must_change = (must_change_reason IS NOT NULL)),
  CHECK (must_change = (must_change_since IS NOT NULL)),
  CHECK (temp_expires_at IS NULL OR must_change_reason = 'reset')
);
ALTER TABLE private.account_passwords ENABLE ROW LEVEL SECURITY;        -- sem políticas
REVOKE ALL ON TABLE private.account_passwords FROM PUBLIC, anon, authenticated, service_role;

-- 2. Lista de senhas comuns (RN-13 e), na forma dobrada (DA-4). Só no banco (AQ-6).
CREATE TABLE IF NOT EXISTS private.common_passwords (password text PRIMARY KEY);
ALTER TABLE private.common_passwords ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.common_passwords FROM PUBLIC, anon, authenticated, service_role;

-- 3. Limites (DT-09): dois tipos novos de chave na tabela do E1.04.
ALTER TABLE private.sign_in_throttle DROP CONSTRAINT IF EXISTS sign_in_throttle_kind_check;
ALTER TABLE private.sign_in_throttle ADD CONSTRAINT sign_in_throttle_kind_check
  CHECK (kind IN ('identifier', 'origin', 'password_change', 'password_reset'));

-- 4. O Auth não grava senha (RN-14, DT-02). Limpar continua permitido.
CREATE OR REPLACE FUNCTION private.guard_auth_password_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF session_user = 'supabase_auth_admin'
     AND coalesce(NEW.encrypted_password, '') <> ''
     AND (TG_OP = 'INSERT' OR NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password) THEN
    RAISE EXCEPTION 'A senha não é gravada no Auth. Use as funções do app (E2.03, RN-14).'
      USING ERRCODE = '42501';                -- a mensagem nunca traz o valor
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS e203_guard_password_write ON auth.users;
CREATE TRIGGER e203_guard_password_write
  BEFORE INSERT OR UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.guard_auth_password_write();

-- 5. Mudança dos hashes (migration 3, depois da nova sign_in_attempt, na mesma transação):
--    a) auth.users com bcrypt → cofre (password_set_at = updated_at);
--    b) member_access_suspensions com bcrypt → cofre, só se a conta ainda não tem hash lá;
--    c) member_access_suspensions.encrypted_password := NULL (a restauração do E2.01 devolve nulo);
--    d) auth.users.encrypted_password := NULL em todas as contas;
--    e) conferência: nenhuma conta com senha em auth.users. Senão, RAISE e nada muda.
--    Hash fora do formato bcrypt não é copiado: a tarefa 1 confere que não existe nenhum.
```

**O portão** (migration 3 cria; migration 5 liga):
```sql
-- 42501 com app_error: a API responde com erro de permissão (RN-09 b), e a tela distingue pelo código (AQ-3).
CREATE OR REPLACE FUNCTION private.raise_gate(_code text, _message text) RETURNS void
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = _message,
        DETAIL = jsonb_build_object('code', _code)::text, HINT = 'app_error';
END $$;

-- RN-16: a sessão do token ainda existe? Sem usuário (service role, migrations): verdadeiro.
-- Sem session_id na claim: verdadeiro (DA-9).
CREATE OR REPLACE FUNCTION private.assert_session_alive() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _uid uuid := auth.uid();
  _sid text := auth.jwt() ->> 'session_id';
BEGIN
  IF _uid IS NOT NULL AND _sid IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM auth.sessions s WHERE s.id = _sid::uuid AND s.user_id = _uid) THEN
    PERFORM private.raise_gate('session_ended', 'Sua sessão terminou. Entre de novo para continuar.');
  END IF;
  RETURN true;
END $$;

-- RN-09: a conta tem a marca?
CREATE OR REPLACE FUNCTION private.assert_no_password_mark() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (
       SELECT 1 FROM private.account_passwords p WHERE p.auth_user_id = auth.uid() AND p.must_change) THEN
    PERFORM private.raise_gate('password_change_required', 'Para continuar, crie uma nova senha.');
  END IF;
  RETURN true;
END $$;

-- Migration 5: as duas funções de identidade do E2.02 passam pelo portão. CASE garante a ordem.
CREATE OR REPLACE FUNCTION public.viewer_member_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN private.assert_session_alive() AND private.assert_no_password_mark() THEN
    (SELECT m.id FROM public.members m WHERE m.auth_user_id = auth.uid() AND m.deleted_at IS NULL) END
$$;
CREATE OR REPLACE FUNCTION public.viewer_has(_permission public.permission_action) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN false
              WHEN private.assert_session_alive() AND private.assert_no_password_mark()
              THEN public.user_has_permission(auth.uid(), _permission) END
$$;
```

**Funções internas** (`private`, sem EXECUTE para ninguém além do dono). Elas rodam dentro das RPCs *definer*, com os privilégios do dono delas:

| Função | O que faz |
|---|---|
| `fold_password(_p text) RETURNS text` | A forma dobrada (DA-4): troca as letras acentuadas do português (á à â ã ä é è ê ë í ì î ï ó ò ô õ ö ú ù û ü ç ñ, nas duas caixas) pela letra sem acento, tira as marcas combinantes (U+0300 a U+036F) e põe as letras ASCII em minúsculas com `COLLATE "C"`. `IMMUTABLE`. |
| `is_simple_sequence(_f text) RETURNS boolean` | RN-13 (d) sobre a forma dobrada: só dígitos, cada um o anterior +1 ou −1 com volta no 9 (DA-5); ou só `a`–`z`, cada uma a anterior +1 ou −1, sem volta. |
| `password_policy_violation(_password text, _cpf text, _mobile text, _birth_date date, _email text) RETURNS text` | O ponto único da política no servidor ([Política de senha](#política-de-senha-rn-13)). Devolve o código da primeira regra violada, ou nulo. |
| `generate_temporary_password(_cpf, _mobile, _birth_date, _email) RETURNS text` | RN-03 ([Senha temporária](#senha-temporária-rn-03-e-rn-05)) |
| `write_password(_auth_user_id uuid, _member_id uuid, _password text, _set_by uuid) RETURNS void` | `INSERT … ON CONFLICT (auth_user_id) DO UPDATE` no cofre com `extensions.crypt(_password, extensions.gen_salt('bf', 10))`, `password_set_at = now()` e `password_set_by`. Chama `discard_legacy_credential(_member_id)`. Recusa (22023) senha acima de 72 bytes. É o único lugar que grava `password_hash`. |
| `set_must_change(_auth_user_id uuid, _reason text, _temp_expires_at timestamptz) RETURNS boolean` | Põe a marca. Devolve verdadeiro só quando a conta ainda não tinha a marca (para a Auditoria registrar uma vez, RN-08). Com `_reason = 'reset'`, sempre regrava o motivo, o `must_change_since` e a validade. |
| `clear_must_change(_auth_user_id uuid, _session_id uuid, _request_id uuid) RETURNS void` | Tira a marca e a validade e guarda a sessão e a chave da troca (DA-13) |
| `end_sessions(_auth_user_id uuid, _keep_session_id uuid) RETURNS void` | Apaga as sessões da conta, menos a `_keep_session_id` quando ela vem, e os *refresh tokens* delas e os sem sessão, como a `_del_suspend_access` do E2.01 |
| `usable_account(_auth_user_id uuid) RETURNS uuid` | A conta, quando ela existe nas condições da DA-3; senão, nulo |
| `discard_legacy_credential(_member_id uuid) RETURNS void` | Ponto do E3.01 e do E3.02: neste passo, não faz nada. O E3.01 a recria para apagar a credencial legada pendente (RN-04) |
| `throttle_lock(_kind text, _value text, _window interval) RETURNS private.sign_in_throttle` | `INSERT … ON CONFLICT (kind, key_hash) DO UPDATE SET kind = EXCLUDED.kind RETURNING *`, com `key_hash = sign_in_key(_kind, _value)`, e poda de `failures` os horários fora da janela. Cria a linha ou trava a que existe, como no E1.04 (DT-03 de lá). |
| `assert_session_alive()`, `assert_no_password_mark()`, `raise_gate(…)` | O portão (acima) |
| `reset_refused(_reason text, _target_id uuid, _retry_after_minutes int DEFAULT NULL) RETURNS jsonb` | Registra a recusa num sub-bloco que engole erro (RN-17) e devolve o JSON de recusa da redefinição |

**RPCs** (`public`, `SECURITY DEFINER`, `SET search_path = public`). Os privilégios padrão do Supabase dão EXECUTE a `anon` em toda função nova de `public`, então todas começam com `REVOKE EXECUTE … FROM PUBLIC, anon`:

| RPC | Quem chama | EXECUTE | Efeito |
|---|---|---|---|
| `reset_member_password(_member_id uuid) RETURNS jsonb` | a tela, com a sessão de quem redefine | `authenticated` | A redefinição inteira, numa transação ([Redefinição](#redefinição-rn-01-a-rn-06)). `SET lock_timeout = '5s'` (DA-15). |
| `my_password_status() RETURNS TABLE (must_change_password boolean)` | a tela, na abertura e nos eventos de sessão | `authenticated` | A marca de quem chama. Passa por `assert_session_alive`, e não pela marca. `STABLE`. |
| `change_own_password(_auth_user_id uuid, _session_id uuid, _mode text, _current_password text, _new_password text, _confirmation text, _origin text, _request_id uuid) RETURNS jsonb` | a `change-own-password` | `service_role` | A troca inteira, numa transação ([Trocas](#trocas-rn-10-a-rn-12)). `SET lock_timeout = '3s'`. |
| `check_password_policy(_password text, _cpf text, _mobile text, _birth_date date, _email text) RETURNS text` | a `create-user-admin` | `service_role` | `password_policy_violation`, sem gravar nada |
| `set_initial_password(_auth_user_id uuid, _member_id uuid, _password text, _cpf text, _mobile text, _birth_date date, _email text) RETURNS void` | a `create-user-admin` | `service_role` | RN-07: confere a política de novo (menos para `123456`), grava no cofre e põe a marca `initial`, sem validade. Recusa com 22023 + `app_error` e o código da política. |
| `sign_in_attempt` (E1.04, recriada) | a `sign-in` | `service_role` | Ver [Login](#login-rn-05-e-rn-08-b) |

**View:** a `members_view` ganha `password_reset_status text` **no fim** (risco 5 do E1.08), com a regra da AQ-2 ([Contratos](#contratos)).

#### Integridade e privilégios
| Garantia | Como |
|---|---|
| A senha nunca é lida, gravada nem contada pela API | `private` fora dos *Exposed schemas* (E2.01); cofre e lista com RLS sem políticas e sem privilégios, inclusive para `service_role` |
| O Auth não guarda nem troca senha (RN-14) | `auth.users.encrypted_password` nulo depois da migration 3; a guarda recusa o que o Auth tentar gravar; o "Deploy: banco" confere a cada execução (DT-19) |
| Só o banco grava a senha | `private.write_password`, chamada só pelas RPCs deste passo |
| A senha e o que vem com ela andam juntos (RN-17) | Uma transação por RPC: cofre, marca, sessões e Auditoria. Sem gravação em dois sistemas, não há compensação (DT-03). |
| Só a função das trocas troca a senha do próprio membro | `change_own_password` só com EXECUTE para `service_role`; ela confere a sessão viva no banco |
| Marca e validade coerentes | `CHECK`s do cofre |
| Nenhuma senha ou hash fora do cofre | O cofre guarda só o bcrypt. A Auditoria, os logs e a resposta das trocas não têm senha. A temporária só sai uma vez, na resposta da redefinição, com `Cache-Control: no-store`. |

### Política de senha (RN-13)
**Um ponto no servidor, uma gêmea na tela e uma tabela de casos** (ponto 3 do PO, AQ-6):
- **Servidor:** `private.password_policy_violation`. É a mesma função na troca obrigatória e na voluntária, na senha inicial (`check_password_policy` e `set_initial_password`), no login (marca da RN-08 b), no gerador da senha temporária e, no futuro, no E3.02 e no E1.07.
- **Tela:** `src/lib/auth/password-policy.ts`, com as mesmas regras, menos a lista de senhas comuns (e), que fica só no banco.
- **Tabela de casos:** `supabase/tests/fixtures/password-policy-cases.json`.
  - Cada caso tem a senha, os dados pessoais, a senha atual quando há e o código esperado.
  - Os casos da regra (e) têm `server_only: true`.
  - O Vitest roda a gêmea sobre os casos que não são `server_only`. O pgTAP roda a função sobre todos.
  - Como no E1.04 (AQ-3 de lá), o SQL do teste é gerado do JSON, e um teste do Vitest falha se a cópia ficar desatualizada.
  - Entram os critérios da RN-13, da RN-07 e o UX-08, mais os casos de borda: acento composto e decomposto, emoji, 72 e 73 bytes, 7 e 8 pontos de código, CPF de 10 dígitos e e-mail com espaço.

**Regras, na ordem, sobre a senha exatamente como foi digitada:**

| Regra | Código | Servidor | Tela |
|---|---|---|---|
| (a) menos de 8 pontos de código | `password_too_short` | `char_length` | `Array.from(s).length` |
| (a) mais de 72 bytes | `password_too_long` | `octet_length` | `new TextEncoder().encode(s).length` |
| (c) todos iguais, na forma dobrada | `password_weak` | `fold ~ '^(.)\1*$'` | o mesmo |
| (d) sequência simples, na forma dobrada | `password_weak` | `is_simple_sequence` | o mesmo |
| (e) na lista de senhas comuns, na forma dobrada | `password_weak` | `private.common_passwords` | — (só o servidor) |
| (f) palavra do contexto seguida só de não letras | `password_weak` | `fold ~ '^(senha\|mudar\|igreja\|mci\|mci12\|mci12rs\|g12\|connect)[^a-z]*$'` | o mesmo |
| (g) dados pessoais (DA-6) | `password_personal_data` | sem `.`, `-`, `/` e espaço: contém o CPF de 11 dígitos, os 8 últimos dígitos do celular ou o nascimento `DDMMYYYY`; ou é igual ao e-mail (`btrim`, minúsculas ASCII) | o mesmo, com o cadastro que a tela tem |
| (h) igual à atual (só nas trocas) | `password_same_as_current` | obrigatória: `crypt(nova, hash) = hash`; voluntária: `nova = atual` (a atual já foi conferida) | voluntária: `nova === atual` |
| confirmação diferente (só nas trocas) | `password_mismatch` | `nova <> confirmação` | o mesmo |

- **Lista de senhas comuns:**
  - a base é a `10k-most-common.txt` do [SecLists](https://github.com/danielmiessler/SecLists), sob licença MIT, que atende às "10.000 senhas mais comuns de listas públicas de vazamentos" da RN-13 (e);
  - a carga guarda a forma dobrada, sem repetidas, só das senhas com 8 pontos de código ou mais e até 72 bytes, porque as menores já caem em (a);
  - o cabeçalho da migration registra a URL, o commit de origem, a regra do filtro e a contagem;
  - acrescentar uma lista brasileira depois é só uma migration com mais `INSERT`s.
- **Onde vale:**
  - nas trocas, de (a) a (h) mais a confirmação, na ordem da DA-7;
  - na senha inicial digitada, de (a) a (g), e `123456` exata vale como vazio (RN-07);
  - no login, de (a) a (g), só para decidir a marca. Ninguém é recusado por ela (RN-08 b);
  - na senha temporária, de (a) a (g), no laço do gerador.
- **Mensagens:** os códigos são os mesmos em todos os caminhos. O texto de cada um fica na tela (`src/lib/auth/password-texts.ts`), em segunda pessoa nas trocas e sobre o membro na senha inicial (RN-07, P-SEN-21).

### Senha temporária (RN-03 e RN-05)
- **Alfabeto:** 31 símbolos, `23456789abcdefghjkmnpqrstuvwxyz` (sem 0, 1, i, l e o). São 8 caracteres, cerca de 39,6 bits.
  - Contra os limites do E1.04 (5 tentativas a cada 15 minutos por identificação), 7 dias dão no máximo 3.360 tentativas, contra 8,5 × 10¹¹ combinações.
- **Aleatoriedade:** `extensions.gen_random_bytes` (gerador seguro do OpenSSL), com rejeição: só os bytes menores que 248 (31 × 8) são aceitos, e o caractere é `byte % 31`. Assim, nenhum símbolo sai mais que os outros.
- **Política:** o gerador confere `password_policy_violation` com os dados do alvo e sorteia de novo se alguma regra falhar. Isso acontece, por exemplo, com `23456789`, que é uma sequência. Depois de 10 sorteios sem sucesso, dá erro, e a redefinição inteira volta, sem efeito.
- **Validade:** `temp_expires_at = now() + interval '168 hours'`, no cofre. A `sign_in_attempt` a lê (DT-11). A resposta devolve `expires_at` em UTC, e a tela mostra em `America/Sao_Paulo`.
- **Vencida:** o hash fica no cofre, para que o login saiba dizer "Senha temporária vencida" quando a senha digitada era ela (RN-05). A conta fica sem senha válida até a próxima redefinição.
- **Nunca legível:** só o bcrypt vai para o cofre. A senha sai uma vez, no JSON da resposta, com `Cache-Control: no-store` (`set_config('response.headers', …)`). Ela não vai para a Auditoria, para o `RAISE` nem para os logs, e a RPC não a recebe como parâmetro.

### Redefinição (RN-01 a RN-06)
```sql
CREATE OR REPLACE FUNCTION public.reset_member_password(_member_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public SET lock_timeout = '5s' AS $$
DECLARE
  _me      uuid := public.viewer_member_id();            -- a partir do PR 4, passa pelo portão
  _row     private.sign_in_throttle;
  _target  public.members;
  _auth    uuid;
  _temp    text;
  _expires timestamptz;
BEGIN
  PERFORM set_config('response.headers', '[{"Cache-Control": "no-store"}]', true);

  -- 1. Permissão (RN-01). Sem cadastro, sem função ou sem "Redefinir Senha de Membros".
  IF _me IS NULL OR NOT public.viewer_has('change_member_password') THEN
    RETURN private.reset_refused('no_permission', _member_id);
  END IF;

  -- 2. Limite (RN-06): trava a linha de quem redefine e poda a janela de 60 minutos.
  _row := private.throttle_lock('password_reset', _me::text, interval '60 minutes');
  IF cardinality(_row.failures) >= 20 THEN               -- aqui, failures guarda as aceitas
    RETURN private.reset_refused('rate_limited', _member_id,
             greatest(1, ceil(extract(epoch FROM _row.failures[1] + interval '60 minutes'
                                                   - clock_timestamp()) / 60)::int));
  END IF;

  -- 3. Alvo. A trava conflita com o FOR UPDATE de delete_member (E2.01), e a releitura vem depois dela.
  SELECT * INTO _target FROM public.members WHERE id = _member_id FOR KEY SHARE;
  IF NOT FOUND                        THEN RETURN private.reset_refused('out_of_scope', NULL);      END IF; -- DA-1
  IF _target.deleted_at IS NOT NULL   THEN RETURN private.reset_refused('member_deleted', _target.id); END IF; -- DA-2
  IF NOT public.viewer_sees_member(_target.id) THEN RETURN private.reset_refused('out_of_scope', _target.id); END IF;
  -- 4 a 6.
  IF _target.id = _me                 THEN RETURN private.reset_refused('self', _target.id);          END IF;
  IF NOT public.viewer_covers_role(_target.role_id) THEN RETURN private.reset_refused('role_not_covered', _target.id); END IF;
  _auth := private.usable_account(_target.auth_user_id);                                                   -- DA-3
  IF _auth IS NULL                    THEN RETURN private.reset_refused('no_account', _target.id);    END IF;

  -- 7. Gravação, sem engolir erro: se a Auditoria falhar, nada muda (RN-17).
  _temp := private.generate_temporary_password(_target.cpf, _target.mobile_whatsapp, _target.birth_date, _target.email);
  _expires := now() + interval '168 hours';
  PERFORM private.write_password(_auth, _target.id, _temp, _me);          -- trava a linha do cofre
  PERFORM private.set_must_change(_auth, 'reset', _expires);
  PERFORM private.end_sessions(_auth, NULL);                              -- RN-16: todas as sessões do alvo
  UPDATE private.sign_in_throttle                                         -- só a aceita conta (RN-06)
     SET failures = failures || clock_timestamp(), expires_at = clock_timestamp() + interval '60 minutes'
   WHERE kind = _row.kind AND key_hash = _row.key_hash;
  PERFORM public._log_event('password_reset', 'auth', _target.id, _target.name, 'Senha redefinida',
            NULL, jsonb_build_object('valid_until', _expires), true, NULL);
  RETURN jsonb_build_object('result', 'ok', 'password', _temp, 'expires_at', _expires, 'reset_at', now());
END $$;
```
- **A ordem das recusas é a da RN-02.** O limite vem antes do alvo, e por isso a pessoa sem permissão nunca descobre nada sobre o alvo.
- **O que a resposta diz:** `out_of_scope` e `member_deleted` saem com o mesmo código, `not_found`, e o mesmo texto. Só a Auditoria distingue.
- **Recusa:** devolve o JSON e faz *commit*. O registro da recusa fica gravado, e nada mais mudou (RN-02). Se o registro falhar, a resposta não muda (RN-17).
- **Sucesso:** o `_log_event` roda fora de qualquer bloco que engula erro. Se falhar, a transação inteira volta: a senha, a marca, as sessões e a contagem.
- **Bloqueio do login (RN-04):** a redefinição não toca nas linhas `identifier` e `origin` do `private.sign_in_throttle`.
- **Senha legada (RN-04, E3.02):** a `write_password` chama `discard_legacy_credential`, que o E3.01 implementa.
- **Mesmo alvo duas vezes:** a segunda redefinição espera a trava da linha do cofre (dentro de `write_password`) e grava por cima. Vale a última, e as duas ficam na Auditoria (RN-04).

### Trocas (RN-10 a RN-12)
**Edge Function `change-own-password`** (`supabase/functions/change-own-password/index.ts`):
1. `OPTIONS`, método e corpo até 4 KB, como na `sign-in` (`_shared/http.ts`).
2. `Authorization: Bearer <token>`. `admin.auth.getUser(token)`: com a sessão apagada, o Auth responde `session_not_found`, e a função devolve 401 `session_ended`.
3. O `session_id` e o `sub` saem do *payload* do token, que o `getUser` já validou.
4. A origem vem do cabeçalho confiável (`_shared/client-ip.ts`, a regra da DT-06 do E1.04, que sai de `sign-in/lib/`). Ela é obrigatória no modo voluntário: sem origem válida em produção, a resposta é 500 (DA-1 do E1.04).
5. Chama `change_own_password` com a chave secreta nova (`SUPABASE_SECRET_KEYS`) e traduz o `result` em HTTP ([Contratos](#contratos)).
6. Os logs têm só o `result`, o tempo e o código interno. Nunca as senhas, o token, o e-mail nem a origem. `Cache-Control: no-store`. `verify_jwt = false` no `config.toml`, como a `create-user-admin`, porque o JWT é conferido dentro dela.

**RPC `change_own_password`**, numa transação:
1. **Entrada:** `_mode` é `forced` ou `voluntary`, e `_request_id` é obrigatório.
   - A senha nova e a confirmação são obrigatórias, e a atual também, no modo voluntário. Faltando alguma: `empty_fields`, sem contar e sem registrar.
2. **Cadastro:** o membro não excluído da conta. Sem ele: `forbidden`.
3. **Travas, sempre nesta ordem:** as linhas do `private.sign_in_throttle`, em ordem de `(kind, key_hash)`, depois a linha da conta no cofre (`FOR UPDATE`). `auth.users` não é travada: a senha não mora mais lá.
   - No modo voluntário, as linhas são a da origem (`origin`) e a da conta (`password_change`, com a chave `sign_in_key('password_change', auth_user_id)`). No obrigatório, só a da conta.
   - É a mesma ordem de todas as funções que usam a tabela (`identifier` < `origin` < `password_change` < `password_reset`), então não há *deadlock* entre elas.
4. **Sessão:** a `_session_id` precisa existir para a conta, conferida **depois** das travas. Senão, `session_ended`. É o que pega uma redefinição ou uma troca em outro aparelho que terminou enquanto esta esperava.
5. **Reenvio (AQ-5, DA-13):** se `last_change_session_id = _session_id`, `last_change_request_id = _request_id` e `crypt(nova, hash) = hash`, devolve `ok` com `replayed: true`, sem contar, registrar nem mudar nada.
6. **Modo obrigatório:** sem a marca, `not_flagged` (RN-10). A senha atual não é pedida (P-SEN-10).
7. **Modo voluntário:**
   - **Bloqueio vigente** na linha da conta ou na da origem (`blocked_until > clock_timestamp()`): `change_blocked`, com o maior prazo restante, arredondado para cima e no mínimo 1. A senha não é conferida, nada é contado e nada é registrado (RN-12).
   - **Senha atual errada.** Conta como errada quando passa de 72 bytes (DA-5 do E1.04), quando a conta não tem hash ou quando o bcrypt não confere. Nesse caso:
     - o horário entra em `failures` das duas linhas;
     - com a 5ª falha da conta, ela recebe `blocked_until = agora + 15 min`; com a 20ª da origem, a origem também;
     - a Auditoria registra "Falha na troca de senha" e, quando um bloqueio começa, "Troca de senha bloqueada…" (conta) ou `login_blocked` (origem, DA-8), num sub-bloco que engole erro;
     - a resposta é `change_blocked` se esta falha disparou um bloqueio; senão, `current_password_invalid`.
   - Os erros da senha nova não contam (RN-12).
8. **Senha nova:** a política com os dados do cadastro, depois (h), depois a confirmação (DA-7). Uma falha devolve o código, e nada muda nem é contado.
9. **Sucesso**, sem engolir erro:
   - `write_password`;
   - `clear_must_change`, que guarda a sessão e a chave;
   - `end_sessions(conta, _session_id)`: a sessão atual continua, e as outras saem (RN-16);
   - a linha `password_change` volta a zero; a da origem não muda;
   - a Auditoria registra "Senha alterada", com `change_type` `forced` ou `voluntary`.

   A voluntária feita com a marca também tira a marca (critério da RN-11).

**Custo:** a voluntária faz um bcrypt para conferir a atual e outro para gravar. A obrigatória faz um para (h) e outro para gravar. O reenvio custa um.

### Login (RN-05 e RN-08 b)
A `sign_in_attempt` do E1.04 é recriada (`CREATE OR REPLACE`) na migration 3, com o mesmo algoritmo e quatro mudanças. A tarefa 3 copia o corpo final do E1.04 e acrescenta só isto:
1. **Hash:** a conta disponível passa a exigir uma linha no cofre com `password_hash` bcrypt, no lugar de `auth.users.encrypted_password` (DA-9 do E1.04 sobre o cofre). As outras condições de conta disponível não mudam. Continua um bcrypt por tentativa (DT-07 do E1.04).
2. **Temporária vencida (RN-05):** quando o bcrypt confere, mas `temp_expires_at <= clock_timestamp()`:
   - a tentativa vira uma falha, ligada ao cadastro, com o motivo `temp_password_expired` ("Senha temporária vencida");
   - ela conta nos limites e passa pelo piso de 700 ms, como qualquer falha. Nada muda no tempo igual da RN-07 do E1.04.

   Com outra senha, o bcrypt não confere, e o motivo é "Senha incorreta".
3. **Marca no login (RN-08 b):**
   - no sucesso, `password_policy_violation` roda com a senha digitada e o cadastro, sem a regra (h);
   - se alguma regra falhar, chama `set_must_change(conta, 'weak_password', NULL)`. Só quando a marca é nova, a Auditoria registra "Troca de senha exigida", motivo "Senha fora das regras", com o próprio membro como autor (`_actor_user_id`), num sub-bloco que engole erro;
   - quem já tinha a marca não gera registro (RN-08).
4. **Resposta:** o sucesso ganha `must_change_password: boolean`, lido do cofre depois do item 3. A `sign-in` repassa o campo no corpo 200.

A senha digitada nunca é gravada no login, e o `password_action` do E3.02 não muda.

### Senha inicial (RN-07)
A `create-user-admin` (ordem do E2.02, com dois passos a mais):
1. JWT e quem chama, e a entrada, como hoje.
2. **Senha (novo):** vazia, ausente ou exatamente `123456` vira `123456` (D11). Qualquer outra passa por `check_password_policy`, com o CPF, o celular, o nascimento e o e-mail do formulário.
   - Violação: 400 `{ error, code, field: 'password' }`, antes de criar qualquer coisa (AQ-8).
   - A `123456` é a única senha que não passa pela política.
3. `find_deleted_member_matches` e `check_member_insert`, como no E2.01 e no E2.02.
4. `createUser` **sem senha** (`email`, `email_confirm: true`, `user_metadata`). Mesmo assim o Auth grava uma senha aleatória, que a guarda descarta na criação (DT-02).
5. **`set_initial_password` (novo),** com a chave secreta: grava a senha no cofre e põe a marca `initial`, sem validade.
6. INSERT do membro com a sessão de quem chama.

- Se o passo 5 ou o 6 falhar, o `deleteUser` que já existe apaga a conta, e a linha do cofre vai junto (`ON DELETE CASCADE`).
- A resposta continua `{ member: { id } }`.
- A conta nasce com a marca nos dois casos, `123456` ou a senha digitada (RN-07). A Auditoria não ganha um registro à parte para isso (RN-17 f).
- **Carga (E4.08):** contas criadas sem senha não têm linha no cofre e não recebem a marca (RN-08).

### Marca na publicação (RN-08 c)
Na migration 5, num `DO`:
- percorre as contas do cofre com `extensions.crypt('123456', password_hash) = password_hash`. Como o cofre já recebeu os hashes das contas suspensas (migration 3), quem foi excluído também entra, e a restauração devolve a marca;
- `set_must_change(conta, 'initial', NULL)`;
- para cada marca nova, a Auditoria registra "Troca de senha exigida", motivo "Senha inicial", sem autor, com o cadastro em `entity_id` e `entity_label`.

Nada fica guardado em claro. O literal `123456` é a senha inicial pública da D11. O custo é um bcrypt por conta: as 5 contas de produção levam menos de 1 segundo. Com o portão ligado na mesma migration, a sessão aberta de quem tem `123456` vai para a troca na próxima ação, e a sessão não é encerrada (RN-16).

### O portão (RN-09 e RN-16)
- **Onde:** em `viewer_member_id()` e `viewer_has()`, as duas portas que o E2.02 deixou para as views, as políticas, os triggers e as RPCs, e em `default_role_id()`. É o mesmo ponto único que o E2.01 usou para cortar o excluído, agora com a sessão e a marca.
- **O que confere:**
  - a sessão do token existe em `auth.sessions` (`session_ended`, RN-16);
  - a conta não tem a marca (`password_change_required`, RN-09).
- **Formato:** 42501, com `HINT = 'app_error'` e `DETAIL` `{ "code": … }`. Para a API, é o erro de permissão que a RN-09 (b) pede. Para a tela, é o código próprio que a AQ-3 pede.
- **Na hora:** as duas leituras são feitas a cada consulta, sem nada em cache. O token de acesso emitido antes da redefinição, da troca em outro aparelho ou da marca deixa de servir na próxima chamada.
- **Fora do portão,** a lista fechada que a pessoa com a marca ainda usa:
  - `my_password_status()`, que confere só a sessão;
  - `log_auth_event('logout')`, que não passa pelas funções de identidade (E2.01, DA-9);
  - a `change-own-password`, que usa a chave secreta e confere a sessão por conta própria;
  - as utilitárias sem dado de ninguém: `sp_today`, `week_start`, `normalize_*`, `is_valid_cpf`, `mobile_match_key`, `is_placeholder_email` e `active_permissions`.
- **Teste de catálogo:** o pgTAP do PR 4 lista toda tabela, view e função com privilégio para `authenticated` (`information_schema.role_table_grants`, `pg_proc` com `has_function_privilege`). Com uma pessoa marcada, cada uma precisa responder com `password_change_required` ou voltar vazia, menos a lista acima. Uma tabela ou função nova que esqueça o portão quebra o teste.
- **Edge Functions:**
  - a `create-user-admin` já passa pelo portão no `check_member_insert`, com a sessão de quem chama (E2.02), e devolve o 403 com o `code`;
  - o `auth.getUser` das funções recusa a sessão apagada antes disso.
- **Custo:** duas buscas por chave primária (`auth.sessions` e o cofre) por chamada. Nas views e políticas, as chamadas são *InitPlan*, feitas uma vez por consulta. Nas funções de linha (`viewer_scope_contains_any`, `viewer_covers_role` na `members_view`), é uma vez por linha da página. A meta está no risco 3.

### Auditoria (RN-17)
Formato único dos eventos de senha (AQ-7). O `entity` é sempre `auth`, como os eventos de login do E1.04, e o cadastro vai em `entity_id` e `entity_label`.

| Situação | `action` | Autor (`actor_user_id`) | Cadastro | `description` | `success` | `error_reason` | `metadata` |
|---|---|---|---|---|---|---|---|
| Senha redefinida | `password_reset` (novo) | quem redefiniu | o alvo | Senha redefinida | true | — | `valid_until` (UTC) |
| Redefinição recusada | `password_reset_refused` (novo) | quem tentou | o alvo, quando existe | Redefinição de senha recusada | false | o motivo em pt-BR | `reason` |
| Senha alterada | `password_changed` (já existe) | o próprio membro | ele mesmo | Senha alterada | true | — | `change_type` (`forced`, `voluntary`) |
| Falha na troca | `password_change_failed` (novo) | o próprio membro | ele mesmo | Falha na troca de senha | false | Senha atual incorreta | `reason: current_password_invalid` |
| Bloqueio da troca | `password_change_blocked` (novo) | o próprio membro | ele mesmo | Troca de senha bloqueada por excesso de tentativas | false | — | `block_minutes` (15) |
| Troca exigida | `password_change_required` (novo) | o próprio membro (login) ou nenhum (publicação) | o membro | Troca de senha exigida | true | — | `reason` (`weak_password`, `initial_password`) |
| Falha no login (E1.04) | `login_failed` | nulo | o cadastro | Falha no login | false | Senha temporária vencida | `reason: temp_password_expired` (código novo na tabela de motivos do E1.04) |

- **Motivos da recusa** (`reason` → `error_reason`):
  - `no_permission` → Sem permissão;
  - `rate_limited` → Limite de redefinições;
  - `out_of_scope` → Fora do que a pessoa vê;
  - `member_deleted` → Cadastro excluído;
  - `self` → Própria senha;
  - `role_not_covered` → Função não coberta;
  - `no_account` → Sem conta de acesso.
- **Autor:** nas trocas e no login, a RPC roda com a chave secreta, então o autor vai pelo `_actor_user_id` do `_log_event`. Na redefinição, é o `auth.uid()` de quem chama.
- **Sucesso junto com o registro:** a redefinição e a troca gravam o evento sem engolir erro, na mesma transação. A recusa, a falha, o bloqueio e a marca do login gravam num sub-bloco `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING … END`, cujo `WARNING` traz só o `SQLSTATE` (RN-17, P-LOG-12 do E1.04).
- **Nada de senha:** nenhum evento leva senha, hash, origem nem o `request_id`. A marca da redefinição e a do cadastro não geram registro à parte (RN-17 f).
- **Volume:**
  - no máximo 20 redefinições aceitas por pessoa por hora, mais as recusas, que dependem de chamadas pela API;
  - por conta, 5 falhas e 1 bloqueio a cada 15 minutos;
  - uma marca por login com senha fraca.
- **Quem lê:** a RLS de `events` não muda (`view_audit_log`).

### Bloqueios e concorrência
**Ordem global das travas.** Ela estende a DT-09 do E2.01:
1. linhas do `private.sign_in_throttle`, em ordem de `(kind, key_hash)`;
2. relatório → célula → membros, como no E2.01;
3. `auth.users` (só a suspensão do E2.01 a trava);
4. o cofre;
5. sessões, *refresh tokens* e eventos.

Nenhuma função deste passo pega uma trava de um nível acima depois de uma de nível abaixo. A `delete_member` (membros → `auth.users` → sessões) e a `sign_in_attempt` (limites → cofre) seguem a mesma ordem.

| Operação | Limites | Membros | `auth.users` | Cofre | Sessões |
|---|---|---|---|---|---|
| `reset_member_password` | `password_reset` de quem redefine | alvo `FOR KEY SHARE` | — | `FOR UPDATE` (na gravação) | apaga todas |
| `change_own_password` | `origin` e `password_change` | — | — | `FOR UPDATE` | apaga as outras |
| `sign_in_attempt` | `identifier` e `origin` (E1.04) | — | — | atualiza a marca | — |
| Marca na publicação | — | — | — | atualiza | — |

Os casos dos critérios:
- **25 redefinições de Pedro ao mesmo tempo:** passam em fila pela linha `password_reset` dele. As 20 primeiras são aceitas, e as outras 5 recebem `rate_limited`. Acima de 5 segundos de espera, a chamada vira erro de conexão (DA-15).
- **20 trocas de Caio com a senha atual errada:** passam em fila pela linha `password_change`. As 5 primeiras têm o bcrypt; a 5ª dispara o bloqueio, e as outras 15 recebem `change_blocked` sem conferir nada.
- **André e Pedro redefinem Caio ao mesmo tempo:** a segunda gravação espera a linha do cofre e grava por cima. Vale a última (RN-04).
- **Redefinição × exclusão do mesmo membro (E2.01):**
  - se a exclusão trava primeiro, a redefinição espera, relê e recusa com "Cadastro excluído";
  - se a redefinição trava primeiro, a exclusão espera e suspende a conta depois. A senha temporária e a marca ficam no cofre e voltam na restauração.
- **Troca obrigatória em dois aparelhos ao mesmo tempo:** a segunda espera a linha da conta. Depois da trava, ela encontra a própria sessão apagada pela primeira e recebe `session_ended` (RN-16).
- **Redefinição × troca do alvo em andamento:** as duas disputam a linha do cofre.
  - Se a troca termina antes, a redefinição grava por cima e encerra todas as sessões.
  - Se a redefinição termina antes, a troca encontra a sessão apagada e recebe `session_ended`.
- **Redefinição × login do alvo com a senha antiga:** fica o risco 12 do E1.04, uma janela de cerca de 200 ms entre a conferência e a emissão da sessão (risco 9).
- **Marca na publicação com sessões abertas:** a migration roda numa transação. A próxima chamada de cada sessão, depois do *commit*, encontra a marca.
- **Deadlocks residuais:** a `end_sessions` apaga linhas de `auth.sessions` e `auth.refresh_tokens` que a renovação do Auth pode estar travando. O Postgres detecta e aborta uma das duas (40P01). Para a tela, é o erro de conexão, e tentar de novo resolve. É a mesma classe do E2.01.

### Contratos
**RPC `reset_member_password`** (AQ-1), pelo PostgREST, com a sessão de quem redefine. Sempre HTTP 200, com `result`:

| `result` | Corpo | Quando |
|---|---|---|
| `ok` | `{ "password": "k7m2x9pa", "expires_at": "2026-12-06T02:50:00+00:00", "reset_at": "…" }` | RN-03 |
| `refused` | `{ "code": "no_permission" \| "rate_limited" \| "not_found" \| "self" \| "role_not_covered" \| "no_account", "message": "<texto do PO>", "retry_after_minutes": N }` | RN-02 e RN-06. `retry_after_minutes` só em `rate_limited`, já arredondado para cima. |

Erros, fora do `result`:
- 403 com o 42501 do portão (`session_ended` ou `password_change_required`), a partir do PR 4;
- erro do banco, tempo de trava esgotado ou falha da Auditoria: a tela mostra o erro de conexão.

**Edge Function `change-own-password`** (`POST /functions/v1/change-own-password`, `Authorization: Bearer <access token>` e `apikey`; AQ-4):

Corpo: `{ "mode": "forced" | "voluntary", "current_password"?: string, "new_password": string, "confirmation": string, "request_id": uuid }`

| HTTP | Corpo | Quando |
|---|---|---|
| 200 | `{ "result": "ok", "replayed"?: true }` | Troca feita (RN-10, RN-11) ou reenvio (DA-13) |
| 400 | `{ "result": "empty_fields" }` | Campo vazio ou corpo malformado, sem contar |
| 400 | `{ "result": "invalid", "code": "password_too_short" \| "password_too_long" \| "password_weak" \| "password_personal_data" \| "password_same_as_current", "field": "new_password" }` | RN-13 |
| 400 | `{ "result": "invalid", "code": "password_mismatch", "field": "confirmation" }` | Confirmação diferente |
| 401 | `{ "result": "session_ended" }` | Sessão apagada (RN-16) |
| 403 | `{ "result": "not_flagged" }` | Troca sem a senha atual numa conta sem a marca (RN-10) |
| 403 | `{ "result": "forbidden" }` | Conta sem cadastro, ou cadastro excluído |
| 422 | `{ "result": "current_password_invalid" }` | RN-11 |
| 429 | `{ "result": "change_blocked", "retry_after_minutes": N }`, mais o cabeçalho `Retry-After: <segundos>` | RN-12 |
| 500 | `{ "result": "server_error" }` | Banco, contagem ou origem. Não conta. |

**RPC `change_own_password`** (só `service_role`): devolve `jsonb` com o mesmo `result` e os mesmos campos, mais `retry_after_seconds` no bloqueio. A função faz a tradução para HTTP.

**RPC `my_password_status()`:** `[{ "must_change_password": boolean }]`. Com a sessão apagada, devolve o 42501 `session_ended`.

**Edge Function `sign-in`** (E1.04): o 200 passa a ser `{ "result": "ok", "session": {…}, "must_change_password": boolean }`.

**Edge Function `create-user-admin`:** o corpo aceita `password` vazio ou ausente. A recusa da política sai como 400 `{ "error": "<texto>", "code": "password_too_short" \| "password_too_long" \| "password_weak" \| "password_personal_data", "field": "password" }` (AQ-8). O 403 do portão leva o `code`.

**Coluna `members_view.password_reset_status`** (AQ-2), na mesma ordem da RN-02, sem o limite:
```sql
CASE WHEN NOT (SELECT public.viewer_has('change_member_password')) THEN NULL
     WHEN m.id = (SELECT public.viewer_member_id())               THEN 'self'
     WHEN NOT public.viewer_covers_role(m.role_id)                THEN 'role_not_covered'
     WHEN m.auth_user_id IS NULL                                  THEN 'no_account'
     ELSE 'allowed' END
```
A conta indisponível da DA-3 (banida, não confirmada) só aparece como recusa depois de confirmar, porque a view não lê `auth.users`.

**Enum:** `event_action` ganha `password_reset`, `password_reset_refused`, `password_change_failed`, `password_change_blocked` e `password_change_required`.

**Dados:** a função Líder ganha `change_member_password` (migration 5, RN-01). A Administrador já tem todas pelo atalho `is_system` (E2.02).

**Workflow "Deploy: banco"** (PR 1):
- `EDGE_FUNCTIONS` ganha `change-own-password`, e `EDGE_FUNCTIONS_REMOVED` ganha `change-member-password`;
- um passo depois das migrations falha se `auth.users` tiver alguma senha não vazia ou se o trigger `e203_guard_password_write` não existir (DT-19). É uma consulta só de leitura, pelo `DB_URL`.

**Configuração do Auth:** nada muda. A política do Auth fica no mínimo de 6 e sem caracteres obrigatórios (D11), e as duas opções de troca segura ficam desligadas, porque o Auth não tem senha para conferir.

### Front
Segue o padrão do E1.08, do E2.01 e do E2.02: os componentes cuidam da tela, o acesso a dados fica nos hooks e serviços, e a regra pura fica em `src/lib/`.

- **Domínio puro, com Vitest e sem React nem Supabase:**
  - `src/lib/auth/password-policy.ts`:
    - `passwordPolicyViolation(password, personal, current?)` devolve o código ou `null`, com `foldPassword`, `isSimpleSequence` e as contagens em pontos de código e bytes;
    - o Vitest roda sobre a tabela de casos.
  - `src/lib/auth/password-texts.ts`: **todos** os textos deste spec (Textos de tela e Experiência > Textos), com a versão em segunda pessoa e a sobre o membro, e as funções de plural ("1 minuto").
  - `src/lib/auth/password-results.ts`:
    - `parseChangePasswordResponse(status, body)`, que devolve uma união tipada;
    - `parseResetResult(data)`;
    - `fieldForCode(code)`, que diz em que campo vai a mensagem.

    *Type guards* e nenhum `any`. Qualquer coisa fora do contrato vira `server_error`.
  - `src/lib/auth/temporary-password.ts`:
    - `displayGroups(password)`, os dois grupos de 4;
    - `spellForScreenReader(password)`;
    - `formatValidUntil(isoUtc)` e `formatResetTime(isoUtc)`, com `Intl.DateTimeFormat` em `America/Sao_Paulo` (UX-23 com o fuso do aparelho simulado);
    - `nextStepForRefusal(code)`, o que a tela faz depois de fechar (T6).
  - `src/lib/members/password-row.ts`: qual linha "Senha" a T5 mostra, a partir de "é o próprio cadastro", "tem conta" e `password_reset_status`.
  - `src/lib/errors.ts` (E2.01): o `parseAppError` passa a aceitar `HINT = 'app_error'` com qualquer SQLSTATE (22023 e 42501). Ganha `GATE_CODES` e `gateCode(error)`.
  - `src/lib/audit/auth-events.ts` (E1.04): os seis rótulos de ação, os motivos, o tipo de troca, a validade e a duração, a segunda linha da descrição e os campos do painel (T8).
  - `src/lib/access/permissions.ts` (E2.02): o rótulo "Redefinir Senha de Membros" e a dica (T7).
- **Serviços e hooks:**
  - `src/services/auth/change-own-password.ts`: `requestPasswordChange(input, { accessToken, timeoutMs: 20_000 })`. Faz um `fetch` com `Authorization` e `apikey` e um `AbortController`, como o `requestSignIn` do E1.04. Rede, tempo-limite e 5xx viram `server_error`.
  - `src/hooks/use-change-own-password.ts`: gera o `request_id` com `crypto.randomUUID()` ao abrir o diálogo ou a tela e o repete nos reenvios.
  - `src/hooks/use-password-reset.ts`: `supabase.rpc('reset_member_password', …).abortSignal(signal)`, com 20 s.
    - Usa `useMutation` com `gcTime: 0`, e o diálogo chama `reset()` ao concluir. A senha fica só no estado do componente, que é limpo ao fechar (P17).
    - Na volta, invalida `["members"]`.
- **`AuthContext`:**
  - estado `mustChangePassword`, preenchido:
    - pelo `must_change_password` da `sign-in`, antes do `setSession`;
    - por `my_password_status()` na abertura com sessão guardada, nos eventos `SIGNED_IN` e `TOKEN_REFRESHED` e na volta do foco;
    - pelo código `password_change_required` vindo de qualquer chamada;
  - enquanto a marca vale, não lê `my_access()` nem o próprio cadastro (RN-09 b; AQ-3: "não é conta sem cadastro");
  - `handleGateError(code)`:
    - `password_change_required` liga a marca, e o portão de rotas leva à troca, sem toast;
    - `session_ended` encerra a sessão localmente (`signOut({ scope: 'local' })`, porque ela já não existe no Auth) e abre `/login` com `state.reason = 'session_ended'`;
  - o `QueryCache` e o `MutationCache` (E2.01) chamam `handleGateError` **antes** dos tratamentos de 42501 do E2.01 e do E2.02. Senão, a releitura do cadastro e do acesso cairia no portão de novo;
  - depois da troca obrigatória: desliga a marca, chama `supabase.auth.refreshSession()` para que as outras abas recebam o evento e releiam o status, e relê o acesso (P13);
  - o `signOut` pedido pelo usuário não muda (leitura técnica 3).
- **Rotas (`App.tsx`):**
  - `/change-password` (T2), fora do `AppLayout`;
  - o `ProtectedRoute` e o `PublicRoute` mandam quem tem a marca para `/change-password` com `replace`;
  - sem a marca, `/change-password` leva a `/`.
- **Componentes:**
  - `src/components/auth/PasswordInput.tsx` (P15), usado no login (E1.04), nas trocas e na senha inicial;
  - `src/components/auth/PasswordRules.tsx` (P16);
  - `src/pages/ChangePassword.tsx` (T2);
  - `src/components/auth/ChangeOwnPasswordDialog.tsx` (T3);
  - `src/components/members/ResetPasswordDialog.tsx` (T6, com a P17 em `TemporaryPasswordView`);
  - `src/components/members/MemberPasswordRow.tsx` (T5).
- **Telas:**
  - `Login.tsx` (T1): o texto da RN-15 e o `PasswordInput`;
  - `AppSidebar` (T4);
  - `MemberForm` (T5):
    - saem o botão "Alterar Senha", o diálogo "Nova Senha" e a chamada à `change-member-password`;
    - a senha inicial vai para a seção Acesso, com a política e as recusas da AQ-8;
  - `Members.tsx`: a ação "Redefinir senha" no `RowActionsMenu` (E2.01), pela `password_reset_status` da linha;
  - `Events.tsx` (T8).
- **Leituras:** `src/lib/members/fields.ts` acrescenta `password_reset_status` às colunas da lista e do formulário.

### Onde cada regra é imposta
| RN | Banco e servidor | UI |
|---|---|---|
| RN-01 | `viewer_has('change_member_password')` na RPC; a Líder com a permissão (migration 5); sem atalho por `manage_roles` | Ação só com a permissão (`password_reset_status` não nulo); rótulo e dica em Funções |
| RN-02 | `reset_member_password`, na ordem da RN-02: trava do alvo, `deleted_at`, `viewer_sees_member`, próprio, `viewer_covers_role`, `usable_account` | `password_reset_status` antecipa próprio, função e conta (T5, P-SEN-20) |
| RN-03 | `generate_temporary_password` (gerador seguro, rejeição, política); só o bcrypt no cofre; a senha sai uma vez, com `no-store` | P17: exibição única, copiar e compartilhar só a senha, nada em cache |
| RN-04 | `write_password` + `set_must_change` + `end_sessions` numa transação; `discard_legacy_credential`; o limite do login não é tocado | — |
| RN-05 | `temp_expires_at` no cofre; `sign_in_attempt` recusa a vencida com o motivo próprio, no mesmo bcrypt | "Válida até" a partir de `expires_at` |
| RN-06 | `throttle_lock('password_reset')` com trava antes de contar; só as aceitas entram; `lock_timeout` | Mensagem com {N} |
| RN-07 | `check_password_policy` antes de criar; `set_initial_password` (política de novo, cofre, marca `initial`, sem validade); `123456` como vazio | Campo em Acesso, política na tela, recusa do servidor no campo |
| RN-08 | `set_initial_password` (a), `reset_member_password` (a), `sign_in_attempt` (b), migration 5 (c), ponto do E3.02 (d); a marca só sai em `clear_must_change` | `mustChangePassword` no `AuthContext` |
| RN-09 | Portão em `viewer_member_id`, `viewer_has` e `default_role_id`; teste de catálogo; `create-user-admin` pelo ensaio | Rotas para `/change-password`; nenhuma leitura com a marca |
| RN-10 | `change_own_password` `forced`: exige a marca; (h) por bcrypt; política; confirmação | T2 |
| RN-11 | `change_own_password` `voluntary`: sem permissão, com a senha atual conferida no banco | T3, no menu e no próprio cadastro |
| RN-12 | Linhas `password_change` e `origin` travadas antes do bcrypt; bloqueio na linha; zera só no sucesso | Mensagem com {N}, sem contagem regressiva |
| RN-13 | `password_policy_violation` (servidor), com a lista no banco | `password-policy.ts`, sem a lista; a mesma tabela de casos |
| RN-14 | Senha só no cofre; `auth.users` sem hash; guarda `e203_guard_password_write`; conferência no "Deploy: banco" | O app chama só a RPC e a `change-own-password` |
| RN-15 | DT-01 do E1.04 (`/recover` recusado); a guarda recusa a troca por um link | Texto no login |
| RN-16 | `end_sessions` na redefinição (todas) e na troca (as outras); portão `session_ended` para o token já emitido | Login com o aviso do E2.01 |
| RN-17 | `_log_event` sem engolir no sucesso e engolindo nas recusas; ações e chaves estáveis; nada de senha | Rótulos, segunda linha e painel (T8) |

### Respostas às perguntas do UX (AQ-1 a AQ-9)
| # | Resposta |
|---|---|
| AQ-1 | **Sim, com um ajuste:** a redefinição é uma RPC, e não uma Edge Function (DA-10), então não há `FunctionsHttpError`. A resposta é sempre 200, com `result: 'ok'` (senha, `expires_at` em UTC e `reset_at`) ou `result: 'refused'` com `code` (`no_permission`, `rate_limited` com `retry_after_minutes`, `not_found` para fora do que se vê e para excluído, `self`, `role_not_covered`, `no_account`) e `message`. Tempo-limite de 20 s com `.abortSignal()`. Erro do banco, rede e tempo-limite são o erro de conexão. |
| AQ-2 | **Sim.** `members_view.password_reset_status`: `allowed`, `self`, `role_not_covered` ou `no_account`, e nulo para quem não tem a permissão. É a regra da RPC, sem o limite. A lista e o cadastro leem a mesma coluna, sem chamada a mais. |
| AQ-3 | **Sim, com a marca no banco, e não no `app_metadata`** (DA-11). A tela sabe dela pelo `must_change_password` da `sign-in`, por `my_password_status()` e pelo código `password_change_required`. Esse código vem como 42501 + `app_error` de tabelas, views, RPCs e da `create-user-admin`; a sessão encerrada tem o código `session_ended`. Depois da troca, a tela desliga a marca, chama `refreshSession()` e relê o acesso. O logout é aceito com a marca, e a leitura recusada nunca é tratada como "conta sem cadastro". A rota é `/change-password`, com o portão no `ProtectedRoute`. |
| AQ-4 | **Sim.** Os códigos e o campo de cada um estão em [Contratos](#contratos). Também existem `empty_fields`, `forbidden`, `session_ended` e `server_error`. |
| AQ-5 | **Sim.** O `request_id` é gerado ao abrir o diálogo ou a tela e repetido nos reenvios. O servidor responde `ok` com `replayed` quando são a mesma sessão, a mesma chave e a mesma senha nova (DA-13), sem gastar tentativa. `not_flagged` na troca obrigatória segue a DA-14. Na redefinição, o reenvio gera outra senha e invalida a perdida (RN-04); ele conta no limite e fica na Auditoria. |
| AQ-6 | **Um ponto no servidor e uma gêmea na tela, presos pela mesma tabela de casos** ([Política de senha](#política-de-senha-rn-13)). A lista de senhas comuns fica só no banco. A tela conta 8 em pontos de código (`Array.from`) e 72 em bytes (`TextEncoder`), como o banco (`char_length`, `octet_length`). Na troca obrigatória, só o servidor confere os dados pessoais. |
| AQ-7 | `action`: `password_reset`, `password_reset_refused`, `password_changed`, `password_change_failed`, `password_change_blocked` e `password_change_required`. O `entity` é `auth`, então o painel da T2 do E1.04 serve como está. Chaves estáveis em `metadata`: `reason`, `change_type`, `valid_until` (UTC) e `block_minutes`. O cadastro vai em `entity_id` e `entity_label`. Autores e motivos em [Auditoria](#auditoria-rn-17). |
| AQ-8 | **Sim.** A `create-user-admin` confere a política com os dados do formulário antes de criar a conta e recusa com 400 `{ error, code, field: 'password' }`. `123456` exata vale como vazio. |
| AQ-9 | **Sim** (tarefas 8, 11 e 13). |

**Pontos do PO** ("Pontos para o `architect`"):

| # | Onde |
|---|---|
| 1 | [Implantação](#implantação) e [Dependências](#dependências-e-impactos-em-outros-passos) |
| 2 | [Avaliação da RN-14](#avaliação-da-rn-14-caminho-único) |
| 3 | [Política de senha](#política-de-senha-rn-13): a do Auth fica como está e deixa de ser usada |
| 4 | [O portão](#o-portão-rn-09-e-rn-16) |
| 5 | DT-03: a senha, a marca, as sessões e a Auditoria estão no mesmo banco e são gravadas na mesma transação |
| 6 | [Senha temporária](#senha-temporária-rn-03-e-rn-05) |
| 7 | [Marca na publicação](#marca-na-publicação-rn-08-c) |
| 8 | [Trocas](#trocas-rn-10-a-rn-12) e [Redefinição](#redefinição-rn-01-a-rn-06) |
| 9 | DA-10 e [Contratos](#contratos) |
| 10 | Leitura técnica 1: sem hash no Auth, a RN-14 não depende da DT-01. A RN-15 depende. |

### Decisões técnicas
| # | Decisão | Motivo |
|---|---|---|
| DT-01 | **(revisar no PR)** A senha fica num cofre do banco (`private.account_passwords`), e o Auth fica sem senha: `auth.users.encrypted_password` é sempre nulo. O login (E1.04) confere no cofre, e só o banco grava nele. | É a única opção do plano gratuito que recusa a troca direta no Auth sem deixar um oráculo da senha atual. Ela também deixa a RN-14 independente da DT-01 do E1.04. |
| DT-02 | Um trigger em `auth.users` recusa qualquer senha não vazia que o Auth (`session_user = 'supabase_auth_admin'`) tente gravar numa conta existente. Na criação da conta, a senha é descartada (vira vazio), em vez de recusada: o `createUser` sempre grava uma senha, aleatória quando não recebe nenhuma, e recusar impediria criar qualquer conta (conferido na stack local no PR 1, 2026-11-26). | Fecha o `PUT /user`, a Admin API e o painel (RN-14). Triggers em `auth.users` continuam permitidos no Supabase hospedado. |
| DT-03 | Toda gravação de senha é SQL, numa transação com a marca, as sessões e a Auditoria. | "Só acontecem junto com o registro" (RN-17) sem compensação entre sistemas. |
| DT-04 | O portão fica em `viewer_member_id`, `viewer_has` e `default_role_id`. Ele confere se a sessão do token existe e se a conta tem a marca, e recusa com 42501 + `app_error` (`session_ended`, `password_change_required`). | "Na hora", inclusive para o token já emitido (RN-09, RN-16), no mesmo ponto único do E2.01. Erro de permissão para a API, código próprio para a tela (AQ-3). |
| DT-05 | A marca e a validade ficam no cofre. A tela as recebe da `sign-in`, de `my_password_status()` e do código do portão. | DA-11 |
| DT-06 | A política tem um ponto no servidor (`private.password_policy_violation`) e uma gêmea na tela, presas por uma tabela de casos. A lista de senhas comuns fica só no banco. | AQ-6 e o padrão do E1.04 (AQ-3 de lá) |
| DT-07 | A redefinição é a RPC `reset_member_password`, *definer*, com a sessão de quem chama. As recusas devolvem JSON e fazem *commit*, para ficarem registradas. | RN-02 com o escopo, a função e o portão do E2.02 e do E2.01. Uma exceção desfaria o registro da recusa. |
| DT-08 | As trocas passam pela Edge Function `change-own-password` (sessão e origem) e pela RPC `change_own_password`, só com a chave secreta. | A RN-12 soma os erros na origem do login, que só a função conhece por um cabeçalho confiável. |
| DT-09 | Os limites usam o `private.sign_in_throttle`, com os tipos `password_reset` (por quem redefine, janela de 60 min, só as aceitas) e `password_change` (por conta). A trava vem antes de contar, sempre em ordem de `(kind, key_hash)`. | RN-06 e RN-12 sob concorrência, sem *deadlock*, reaproveitando a chave HMAC, a limpeza e o algoritmo do E1.04 |
| DT-10 | A senha temporária tem 8 de 31 símbolos, sai de `gen_random_bytes` com rejeição e é conferida pela política. Vale 168 h, guardadas no cofre. | RN-03 e RN-05 |
| DT-11 | A `sign_in_attempt` lê o cofre, recusa a temporária vencida (motivo próprio, mesmo bcrypt), põe a marca pela política e devolve `must_change_password`. | RN-05 e RN-08 b, sem mudar o tempo igual da RN-07 do E1.04 |
| DT-12 | A `create-user-admin` confere a política antes de criar, cria a conta sem senha e grava a inicial com `set_initial_password` (cofre e marca). | RN-07, AQ-8 e a DT-02 |
| DT-13 | A marca na publicação é posta pela migration 5, comparando o bcrypt de `123456` no cofre, que já tem as contas suspensas. | RN-08 c, sem guardar senha em claro |
| DT-14 | Auditoria: cinco ações novas mais `password_changed`, com o `entity` `auth`. O sucesso grava sem engolir erro; a recusa, a falha, o bloqueio e a marca do login engolem. | RN-17, AQ-7 e P-LOG-12 do E1.04 |
| DT-15 | `members_view.password_reset_status` antecipa a recusa previsível. | AQ-2 sem chamada a mais por linha |
| DT-16 | A troca é idempotente por `request_id`, só na mesma sessão e com a mesma senha nova. | AQ-5 (DA-13) |
| DT-17 | Quatro PRs: banco e funções, neutros; front da própria senha; front da redefinição e do cadastro; banco que liga o portão, a Líder e a marca na publicação. | O portão e a marca só valem com um front que leva à troca ([Implantação](#implantação)) |
| DT-18 | `client-ip.ts` e `http.ts` saem de `sign-in/lib/` para `supabase/functions/_shared/`, com os testes. | A `sign-in` e a `change-own-password` usam a mesma regra de origem (DT-06 do E1.04) |
| DT-19 | O "Deploy: banco" falha se alguma conta tiver senha em `auth.users` ou se a guarda não existir. Ele também remove a `change-member-password` (`EDGE_FUNCTIONS_REMOVED`) e publica a `change-own-password`. | Pega uma mudança no Auth que reabriria a RN-14 (risco 2) |

### Riscos (concorrência, escala, segurança)
1. **Ordem de implantação.** Se o portão for ligado antes do front que trata a marca, quem tem a marca fica preso num front que não sabe levar à troca.
   - Mitigação: o portão e a marca na publicação estão só no PR 4, e a tarefa 12 só começa depois dos PRs 2 e 3 promovidos. O banco não tem como conferir qual front está no ar, então a ordem é garantida pela implantação.
   - **Rollback do PR 4:** uma migration que recria `viewer_member_id`, `viewer_has` e `default_role_id` sem o portão. O SQL fica pronto na descrição do PR. A marca pode ficar: sem o portão, a tela continua levando à troca.
2. **A guarda depende do papel do Auth.** Se o Supabase passar a conectar o Auth com outro papel, a guarda deixa de recusar.
   - O login continua só pelo cofre, então uma senha gravada no Auth não abre nada pela `sign-in`.
   - Reabriria o oráculo da senha atual pelo `PUT /user` e, com a DT-01 revista, o login direto.
   - A conferência do "Deploy: banco" (DT-19) e o *smoke* de cada implantação pegam o caso.
3. **Custo do portão.**
   - Cada `viewer_member_id` e `viewer_has` ganham duas buscas por chave primária. Nas views, são *InitPlan* (uma vez por consulta). Na `members_view`, a `password_reset_status` chama `viewer_covers_role` por linha da página (25).
   - Metas, no volume de referência do E2.02 (20 mil membros, um pastor e um G12 com o ministério): página de lista com contagem abaixo de 300 ms; `my_access` abaixo de 50 ms; `dashboard_summary` abaixo de 800 ms.
   - Se alguma meta falhar, a opção é guardar o resultado do portão na transação (`set_config(…, true)`), num passo próprio.
4. **Portão incompleto.** Uma função ou tabela nova que leia dado de negócio sem passar por `viewer_member_id` ou `viewer_has` escapa do portão. O teste de catálogo (PR 4) falha nesse caso, e o `CLAUDE.md` ganha a armadilha.
5. **Senhas como parâmetro SQL.**
   - As trocas e a `sign_in_attempt` recebem a senha como parâmetro da RPC.
   - Se `log_min_duration_statement` estiver ligado em produção com `log_parameter_max_length` diferente de 0, uma chamada lenta registraria o corpo com a senha. Na stack local, os dois estão em -1, o que desliga o log de duração.
   - A tarefa 1 confere a produção e para se o log de duração estiver ligado com parâmetros. É a mesma classe do risco 11 do E1.04.
6. **Escrita no schema do Auth.** O passo apaga linhas de `auth.sessions` e `auth.refresh_tokens` (`end_sessions`) e lê `auth.users` e `auth.sessions`. É a mesma classe da DT-13 do E2.01, mas menor que antes: a senha deixa de ser gravada em `auth.users`. Um pgTAP confere as duas coisas, e o *smoke* de cada implantação testa o login e a renovação.
7. **CPU do bcrypt.**
   - A redefinição custa um bcrypt, mais o da política; a troca, dois; a publicação, um por conta.
   - A troca obrigatória não tem limite de tentativas da política. Uma sessão marcada pode gastar CPU com envios repetidos, mas só da própria conta.
   - Mitigação: acompanhar a CPU no painel, como no risco 3 do E1.04.
8. **Deadlocks com o Auth.** A `end_sessions` pode cruzar com uma renovação de token da mesma conta. O Postgres aborta uma das duas (40P01), e a tela mostra o erro de conexão. É raro e da mesma classe do E2.01.
9. **Login durante a redefinição.** Uma entrada com a senha antiga conferida cerca de 200 ms antes da redefinição pode emitir uma sessão depois dela. É o risco 12 do E1.04, aceito pelo mesmo motivo: a janela é curta, e quem perdeu a senha não está entrando com ela.
10. **Senha temporária no aparelho do líder.** Copiar e compartilhar levam a senha para a área de transferência e para o aplicativo de mensagens, fora do controle do sistema. A validade de 7 dias e a troca obrigatória limitam o efeito.
11. **A janela do `123456`** (observação do PO, D11). Quem conhece o CPF ou o celular de um membro que ainda não entrou consegue entrar com `123456` antes dele. Não muda neste passo.
12. **Testes dos passos anteriores.** Os pgTAP do E1.04 criam contas com o hash em `auth.users`, e o login passa a ler o cofre. Os testes do E1.04, do E2.01 e do E2.02 que mudam de resultado entram na tarefa 5:
    - um ajudante de teste cria a conta e grava a senha no cofre;
    - os testes de sessão ganham `session_id` nas *claims*.
13. **Divergência entre a tela e o banco na política.** A tabela de casos e o teste de sincronia pegam qualquer diferença. A regra (e) é só do servidor, por desenho.
14. **Operação.** O painel do Supabase não troca mais senha (DA-12). A armadilha entra no `CLAUDE.md`, com o caminho de emergência (`private.write_password` no editor SQL).
15. **Lista de senhas na migration.** São cerca de 100 KB de `INSERT`s. Ela é revisada à parte (migration 2), com a origem e a licença no cabeçalho.

### Dependências e impactos em outros passos
| Passo | Relação |
|---|---|
| E1.04 | **Pré-requisito, inteiro em produção (PRs 1 a 3).** Usa a `sign-in`, a `sign_in_attempt`, o `private.sign_in_throttle`, a chave do Vault, o `client-ip.ts` e o `EDGE_FUNCTIONS_REMOVED`. Mudanças: a `sign_in_attempt` lê o cofre, ganha a temporária vencida e a marca; a `sign-in` devolve `must_change_password`; `client-ip.ts` e `http.ts` vão para `_shared/`; os pgTAP de lá passam a criar a senha no cofre. Registrar no spec do E1.04 (tarefa 14). |
| E2.01 | **Pré-requisito, inteiro em produção.** Nenhuma função do E2.01 muda: a suspensão continua esvaziando `auth.users` e guardando o que estava lá (agora, nulo), e o cofre guarda a senha e a marca durante a exclusão. Os hashes já guardados nas suspensões vão para o cofre (migration 3). O plano B do risco 1 de lá (senha aleatória pela Admin API) deixa de ser possível, por causa da guarda. O `parseAppError` passa a aceitar 42501 com `app_error`, e o `QueryCache`/`MutationCache` trata os códigos do portão primeiro. |
| E2.02 | **Pré-requisito, inteiro em produção.** Usa `viewer_sees_member`, `viewer_covers_role`, `default_role_id`, `my_access` e a `members_view`. A migration 5 recria `viewer_member_id`, `viewer_has` e `default_role_id` com o portão. O risco 12 de lá fecha: a `change-member-password` sai, e `is_admin` é removida se nada mais a usar. A Líder ganha "Redefinir Senha de Membros" (RN-16 e P-PER-08 de lá mudam no aceite). |
| E2.04 | Sem conflito. A política usa `normalize_digits` para o CPF e o celular, as mesmas funções dos índices únicos. |
| E1.07 | A recuperação por e-mail grava a senha por `private.write_password`, segue a política e a Auditoria deste passo e tira a marca. O `PUT /user` do link de recuperação é recusado pela guarda, então a troca precisa ser uma função própria. |
| E3.01 | Recria `private.discard_legacy_credential` para apagar a credencial legada (RN-04). |
| E3.02 | Implementa o ponto do legado da `sign_in_attempt` gravando a senha antiga **como foi digitada** com `private.write_password` e, se ela não atender à política, a marca `legacy_weak`, na mesma transação, antes de apagar a credencial (DA-16). O `updateUserById` previsto na DT-14 do E1.04 não serve mais, por causa da guarda, e o valor `set_random_and_flag` do `password_action` deixa de ser necessário. A marca gera "Troca de senha exigida", motivo "Senha fora das regras". |
| E4.08 | As contas da carga nascem **sem senha** (nem no Auth, nem no cofre), e não com uma senha aleatória (6.2). Sem linha no cofre, elas não recebem a marca. Os membros sem senha no legado entram pela redefinição. |
| E5 (ensaios) | Incluir a redefinição por um líder, a troca obrigatória de um membro só com celular e a publicação com uma sessão aberta. |
| Consolidação | O consolidado não tem conta, então é recusado como "Sem conta de acesso". |

### Pontos de extensão
| Futuro | Onde muda |
|---|---|
| Senha legada (E3.01, E3.02) | `private.discard_legacy_credential` e o ponto do legado da `sign_in_attempt`, gravando com `private.write_password` |
| Recuperação por e-mail (E1.07) | Uma função que grava com `private.write_password` e `clear_must_change`, encerra as outras sessões e registra "Senha alterada" |
| Lista de senhas maior ou brasileira | Uma migration com mais `INSERT`s em `private.common_passwords`, na forma dobrada |
| Validade da senha inicial (se a D11 mudar) | `set_initial_password` passa uma validade, e a `sign_in_attempt` já sabe recusar a vencida |
| "Sair de todos os aparelhos" | `private.end_sessions(conta, NULL)` numa RPC própria |
| Desbloqueio manual do login | Fora de escopo (P-LOG-07). Seria uma RPC que apaga as linhas `identifier` de um cadastro (ponto de extensão do E1.04). |

### Implantação
| Passo | Quem | O que | Efeito |
|---|---|---|---|
| PR 1 | usuário | merge → "Deploy: banco" (migrations 1 a 4; publica a `sign-in`, a `create-user-admin` e a `change-own-password`; remove a `change-member-password`; confere o cofre) | A senha passa a morar no cofre, e o `PUT /user` é recusado. Para o usuário do front em produção, nada muda, com três ressalvas: uma senha inicial digitada fora da política é recusada com o texto do servidor; logins com senha fraca recebem a marca, sem efeito na tela até o PR 2; entre as migrations e a publicação das funções, por alguns minutos, o cadastro de membro falha. |
| A | usuário | *Smoke* com contas de teste, por `curl` ([Conferências](#conferências-em-produção-tarefa-1), item 9) | Confirma a RN-14, a redefinição, o login com a temporária e as trocas |
| PR 2 | usuário | merge → promote | Troca obrigatória, "Alterar minha senha" e o texto do login. Quem tem a marca é levado à troca pela tela. |
| PR 3 | usuário | merge → promote | Redefinição no cadastro e na lista, senha inicial em Acesso, Funções e Auditoria |
| PR 4 | usuário | merge → "Deploy: banco" (migration 5), **fora das noites de célula** (P-SEN-24) | O portão passa a valer na API (RN-09, RN-16), a Líder redefine, e as contas com `123456` recebem a marca. O E2.03 pode ser aceito. |

- O promote já recusa rodar com migration pendente. Os PRs 2 e 3 não têm migration.
- **Rollback:**
  - **PR 2 e PR 3:** promote do commit anterior. O PR 2 não volta depois do PR 4, porque o front antigo não leva à troca.
  - **PR 4:** a migration de rollback do risco 1.
  - **PR 1:** só para a frente. Voltar a senha para o Auth exigiria copiar os hashes de volta e tirar a guarda, numa migration nova.

### Conferências em produção (tarefa 1)
Só leitura. A tarefa 1 entrega este SQL, e o usuário roda no banco de produção, depois do E1.04, do E2.01 e do E2.02 em produção. A saída não traz nomes nem hashes.
```sql
-- 1. Pré-requisitos (todos verdadeiros)
SELECT to_regprocedure('public.sign_in_attempt(text,text,text)') IS NOT NULL AS e104_sign_in,
       to_regclass('private.sign_in_throttle') IS NOT NULL             AS e104_throttle,
       to_regclass('private.member_access_suspensions') IS NOT NULL    AS e201_suspensions,
       to_regprocedure('public.viewer_sees_member(uuid)') IS NOT NULL  AS e202_sees_member,
       to_regprocedure('public.my_access()') IS NOT NULL               AS e202_my_access;

-- 2. auth.users: dono, TRIGGER para o postgres e triggers que já existem
SELECT pg_get_userbyid(relowner) AS owner,
       has_table_privilege('postgres', 'auth.users', 'TRIGGER') AS postgres_can_trigger
  FROM pg_class WHERE oid = 'auth.users'::regclass;
SELECT tgname FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;

-- 3. Papel com que o Auth se conecta (esperado: supabase_auth_admin)
SELECT DISTINCT usename FROM pg_stat_activity WHERE usename LIKE 'supabase_auth%';

-- 4. Formato das senhas no Auth e nas suspensões (esperado: só bcrypt de custo 10)
SELECT left(encrypted_password, 7) AS prefix, count(*) FROM auth.users GROUP BY 1;
SELECT left(encrypted_password, 7) AS prefix, count(*) FROM private.member_access_suspensions GROUP BY 1;

-- 5. Quantas contas ainda têm a senha 123456 (só a contagem; um bcrypt por conta)
SELECT count(*) FILTER (WHERE extensions.crypt('123456', encrypted_password) = encrypted_password) AS with_123456,
       count(*) AS bcrypt_accounts
  FROM auth.users WHERE encrypted_password ~ '^\$2[aby]\$';

-- 6. Log de duração com parâmetros (RN-17: nenhuma senha em log)
SHOW log_min_duration_statement;
SHOW log_parameter_max_length;
SHOW log_parameter_max_length_on_error;
SHOW log_statement;

-- 7. Locale do banco (a política não depende dele, mas o teste confere)
SELECT datlocprovider, datcollate, datctype FROM pg_database WHERE datname = current_database();

-- 8. Migrations aplicadas (o E1.04, o E2.01 e o E2.02 inteiros)
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 15;
```
9. **Depois do "Deploy: banco" do PR 1 (passo A),** com uma conta de teste e o token dela:
   - `PUT /auth/v1/user` com `{"password": "…"}` responde erro, e o login pela `sign-in` continua com a senha antiga;
   - `POST /auth/v1/token?grant_type=password` falha;
   - `reset_member_password` com um administrador de teste devolve a temporária, e a `sign-in` com ela devolve `must_change_password: true`;
   - a `change-own-password` no modo obrigatório responde `ok`, e a sessão antiga do outro aparelho de teste deixa de renovar;
   - `SELECT count(*) FROM auth.users WHERE coalesce(encrypted_password, '') <> ''` dá 0.

**Paradas.** A tarefa 1 para e volta ao `architect` se:
- (1) tiver algum falso;
- (2) mostrar que o `postgres` não pode criar o trigger;
- (3) mostrar outro papel;
- (4) tiver algum formato que não seja bcrypt;
- (6) mostrar `log_min_duration_statement` maior ou igual a 0 com `log_parameter_max_length` diferente de 0.

### Verificações obrigatórias (para o QA)
**pgTAP** (`supabase/tests/database/e203_*.test.sql`, autocontido, com `ROLLBACK`). A massa é a do spec, com a do E2.02 mais Olga, Nina (excluída, conta suspensa), Lauro (sem conta) e Caio com os dados fictícios do critério. As contas são criadas sem senha no Auth e com a senha no cofre, por um ajudante de teste.
- **Estrutura e grants:**
  - o cofre e a lista sem privilégio para `anon`, `authenticated` e `service_role`;
  - `reset_member_password` e `my_password_status` só para `authenticated`; `change_own_password`, `check_password_policy` e `set_initial_password` só para `service_role`; nenhuma com `anon`;
  - a guarda existe;
  - depois da migration 3, nenhuma conta com senha em `auth.users` nem nas suspensões;
  - as migrations rodam de novo sem erro.
- **Política (RN-13):** a tabela de casos inteira, inclusive os `server_only`. 8 e 7 pontos de código, 72 e 73 bytes, a forma dobrada com acento composto e decomposto, e a DA-5 e a DA-6.
- **RN-01 e RN-02:** cada critério pela RPC, com a pessoa da massa, conferindo a resposta, o motivo na Auditoria e que nada mudou nas recusas. Inclui a função "Apoio", Hugo, a ordem (Caio contra Nina dá `no_permission`) e a DA-1.
- **RN-03:** 1.000 senhas de `generate_temporary_password`, todas no alfabeto, dentro da política e sem repetição.
- **RN-04:**
  - a senha antiga para de conferir na `sign_in_attempt`, e a temporária confere;
  - o bloqueio do login continua;
  - duas redefinições deixam valendo a última;
  - `discard_legacy_credential` é chamada (com uma versão de teste da função).
- **RN-05:** mexendo em `temp_expires_at`, antes e depois do prazo, com o motivo `temp_password_expired` ou "Senha incorreta" e a contagem no limite.
- **RN-06:** 20 aceitas e a 21ª com os minutos certos (a mais antiga há 52 minutos dá 8); as recusas não contam.
- **RN-07:** `check_password_policy` e `set_initial_password` com `abc12`, `123456`, `Oliveira#7` e o CPF do formulário; a marca `initial` sem validade.
- **RN-08:**
  - (b) com um registro só na primeira entrada;
  - (c) com a função da migration 5 sobre uma massa com `123456`, inclusive numa conta suspensa;
  - a restauração (E2.01) mantém a marca;
  - a conta sem linha no cofre não tem marca.
- **RN-09, teste de catálogo:** com uma pessoa marcada e `session_id` nas *claims*, cada tabela, view e função com privilégio para `authenticated` responde `password_change_required` ou volta vazia, menos a lista fechada. A Rita marcada também.
- **RN-10 a RN-12:** cada código da `change_own_password` e o reenvio (DA-13).
  - O reenvio com outra senha nova não vale como sucesso.
  - 5 erros: a 5ª já devolve `change_blocked`, com 5 registros de falha e 1 de bloqueio; as tentativas durante o bloqueio não registram nada.
  - O sucesso zera a conta e não a origem.
  - Com 45 falhas de login e 5 erros da senha atual da mesma origem, a origem fica bloqueada para o login (DA-8; o limite da origem é 50 desde o E1.04 PR 1b).
  - A troca voluntária com a marca tira a marca.
- **RN-14:**
  - o trigger existe em `auth.users`, e o `postgres` grava e limpa a senha sem recusa;
  - a recusa do papel do Auth é provada de ponta a ponta, contra o Auth da stack local ([Caminho único](#verificações-obrigatórias-para-o-qa), abaixo). O `postgres` não consegue assumir o papel `supabase_auth_admin` no pgTAP (sem `SET ROLE` nem `SET SESSION AUTHORIZATION`, conferido na stack local).
- **RN-16:**
  - a redefinição apaga todas as sessões do alvo; a troca apaga as outras;
  - com `session_id` de uma sessão apagada nas *claims*, qualquer view responde `session_ended`, e `my_password_status()` também;
  - as sessões de quem redefiniu ficam.
- **RN-17:**
  - o conteúdo de cada evento;
  - nenhum evento contém a senha temporária, a nova, a atual, um hash ou a origem (procurar os valores em `events::text`);
  - com um `CHECK` em `events` criado dentro do teste, a redefinição e a troca voltam inteiras, e a recusa responde igual.
- **Testes dos passos anteriores:** os pgTAP do E1.04, do E2.01 e do E2.02 que mudam de resultado são atualizados (risco 12).

**Concorrência** (script com várias conexões, como no E2.01):
- 25 redefinições de Pedro: exatamente 20 aceitas;
- 20 trocas com a senha atual errada: exatamente 5 conferidas;
- duas redefinições do mesmo alvo;
- redefinição × `delete_member`, nas duas ordens;
- troca obrigatória em duas sessões.

**Edge Function** (stack local):
- a `change-own-password`: todos os status e corpos, a sessão apagada (401), a origem forjada que não muda a contagem e os logs sem senha;
- a `create-user-admin`: a recusa da política (400 com `field`), `123456` e a senha digitada no cofre, nenhuma senha em `auth.users`;
- a `sign-in`: `must_change_password`.

**Caminho único (RN-14, stack local, contra o Auth de verdade):**
- o `PUT /auth/v1/user` com senha, com a sessão da própria conta, falha; o cofre e `auth.users` não mudam, e a sessão continua;
- o `updateUserById` com senha falha; o `createUser`, com ou sem senha, passa e a conta nasce sem senha no Auth (DT-02);
- a exclusão de conta pelo Auth (que grava nulo) passa;
- o login por senha direto no Auth falha;
- a renovação da sessão continua funcionando.

**Volume:** as metas do risco 3, com o `EXPLAIN` anexado.

**Vitest:**
- `password-policy.ts` sobre a tabela de casos, e o teste de sincronia;
- `password-results.ts` com respostas fora do contrato;
- `temporary-password.ts`, com o fuso simulado;
- `password-row.ts`;
- `password-texts.ts`, com o singular e sem as palavras proibidas (UX-38);
- `auth-events.ts`;
- `_shared/client-ip.ts` e `http.ts`.

**Playwright:** os critérios de UX de cada PR, mais:
- o *smoke* de login;
- duas sessões para a RN-16 (redefinição e troca);
- a marca durante o uso (UX-13).

## Tarefas
_Seção do `architect`._

Quatro PRs no `mci-connect`. **Tudo começa depois do E1.04, do E2.01 e do E2.02 inteiros em produção.**
- Dentro de cada PR, o banco vai primeiro, e os tipos são regenerados antes do front.
- Cada desenvolvedor aciona o `code-reviewer` ao terminar a sua tarefa; esse passo não aparece na tabela.
- Os passos A e B são do usuário. Eles aparecem na tabela para não serem esquecidos.
- Na coluna RNs, os números são das regras deste spec. Na coluna UX, os dos critérios `UX-`.

| # | Responsável | Descrição | Arquivos | RNs | UX | Depende de |
|---|---|---|---|---|---|---|
| **PR 1: cofre, política, redefinição e trocas no banco e nas funções (neutro para a tela)** | | | | | | |
| 1 | backend-developer | Conferências em produção, **só de leitura e com autorização do usuário**: o SQL de [Conferências](#conferências-em-produção-tarefa-1), itens 1 a 8. Reler as migrations e funções finais do E1.04, do E2.01 e do E2.02 e confirmar os nomes e assinaturas usados aqui (`sign_in_attempt`, `sign_in_key`, `throttle`, `_del_suspend_access`, `viewer_member_id`, `viewer_has`, `viewer_sees_member`, `viewer_covers_role`, `default_role_id`, `members_view`). Parar e voltar ao `architect` nos casos listados lá ou se algum nome divergir. | — | 03, 08, 09, 13, 14, 17 | — | E1.04, E2.01 e E2.02 em produção |
| 2 | backend-developer | Migrations 1 e 2: os cinco valores de `event_action`; a guarda de pré-requisito; `private.common_passwords` com a carga da lista (origem, licença, filtro e contagem no cabeçalho); `fold_password`, `is_simple_sequence`, `password_policy_violation`, `generate_temporary_password` e `check_password_policy`, com os grants. Tabela de casos `password-policy-cases.json` com os critérios da RN-13, da RN-07 e o UX-08. | `supabase/migrations/<ts>_e203_01_enum.sql`, `supabase/migrations/<ts>_e203_02_policy.sql`, `supabase/tests/fixtures/password-policy-cases.json` | 03, 07, 13 | dados de 08 | 1 |
| 3 | backend-developer | Migrations 3 e 4: `private.account_passwords` e as funções internas; os tipos novos no `sign_in_throttle`; a `sign_in_attempt` recriada (cofre, temporária vencida, marca, `must_change_password`), com o corpo final do E1.04; a mudança dos hashes (auth.users e suspensões) com a conferência final; a guarda em `auth.users`; o portão criado e ainda não ligado; `reset_member_password`, `change_own_password`, `set_initial_password` e `my_password_status`; `members_view.password_reset_status` no fim; grants; a ordem das travas no cabeçalho. Regenerar o `types.ts`. | `supabase/migrations/<ts>_e203_03_vault.sql`, `supabase/migrations/<ts>_e203_04_rpcs.sql`, `src/integrations/supabase/types.ts` | 01 a 14, 16, 17 | dados de 21, 23, 27, 28, 39 | 2 |
| 4 | backend-developer | Edge Functions:<br>- `change-own-password` nova (sessão, `session_id`, origem, RPC, HTTP, logs sem senha);<br>- `client-ip.ts` e `http.ts` movidos para `supabase/functions/_shared/`, com os testes;<br>- `sign-in` com `must_change_password` e os imports novos;<br>- `create-user-admin` com a senha inicial (política antes de criar, `createUser` sem senha, `set_initial_password`, códigos da AQ-8, 403 com o `code` do portão);<br>- `change-member-password` apagada.<br><br>No `config.toml`: `[functions.change-own-password] verify_jwt = false` e a seção da `change-member-password` fora. No `deploy-banco.yml`: `change-own-password` em `EDGE_FUNCTIONS`, `change-member-password` em `EDGE_FUNCTIONS_REMOVED` e o passo da DT-19. No `vitest.config.ts`: `supabase/functions/_shared/*.test.ts`. | `supabase/functions/change-own-password/index.ts`, `supabase/functions/_shared/{client-ip,http}.ts`, `supabase/functions/sign-in/index.ts`, `supabase/functions/create-user-admin/index.ts`, `supabase/functions/change-member-password/` (removida), `supabase/config.toml`, `.github/workflows/deploy-banco.yml`, `vitest.config.ts` | 07, 10, 11, 12, 14, 16, 17 | dados de 09, 17, 18, 31 | 3 |
| 5 | qa | pgTAP de [Verificações](#verificações-obrigatórias-para-o-qa) (sem o teste de catálogo do portão, que é do PR 4); o SQL gerado da tabela de casos e a conferência de sincronia; o script de concorrência; os testes das funções; o caminho único na stack local; a atualização dos testes do E1.04, do E2.01 e do E2.02 que mudam (ajudante que cria a conta com a senha no cofre). | `supabase/tests/database/e203_*.test.sql`, `supabase/tests/concurrency/e203_concurrency.sh`, `supabase/functions/_shared/*.test.ts`, `supabase/functions/change-own-password/*.test.ts`, testes existentes afetados | 01 a 08, 10 a 14, 16, 17 | — | 4 (escreve em paralelo com a 2, a 3 e a 4, a partir dos contratos) |
| A | usuário | Passo A: depois do "Deploy: banco" do PR 1, o *smoke* do item 9 das Conferências, com contas de teste | — | 03, 04, 10, 14, 16 | — | PR 1 no ar |
| **PR 2: a própria senha (troca obrigatória, "Alterar minha senha", menu e login)** | | | | | | |
| 6 | frontend-developer | - `src/lib/auth/{password-policy,password-texts,password-results}.ts`, com Vitest (a política sobre a tabela de casos);<br>- `src/lib/errors.ts` com `app_error` em qualquer SQLSTATE, `GATE_CODES` e `gateCode`;<br>- `PasswordInput` (P15) e `PasswordRules` (P16);<br>- `src/services/auth/change-own-password.ts` e `use-change-own-password` (`request_id`);<br>- `ChangePassword` (T2) em `/change-password`, com o portão no `ProtectedRoute` e no `PublicRoute`;<br>- `ChangeOwnPasswordDialog` (T3);<br>- item "Alterar minha senha" no `AppSidebar` (T4);<br>- `AuthContext`: `mustChangePassword`, `my_password_status`, `handleGateError` antes dos tratamentos de 42501, campo da `sign-in`, `refreshSession` depois da troca obrigatória;<br>- `Login.tsx`: o texto da RN-15 e o `PasswordInput` (T1). | `src/lib/auth/*`, `src/lib/errors.ts`, `src/components/auth/*`, `src/services/auth/change-own-password.ts`, `src/hooks/use-change-own-password.ts`, `src/pages/{ChangePassword,Login}.tsx`, `src/contexts/AuthContext.tsx`, `src/components/AppSidebar.tsx`, `src/App.tsx` (e o módulo do `QueryClient`, se for outro) | 08, 09, 10, 11, 12, 13, 15, 16 | 01 a 20, 35 a 38 | PR 1 mergeado (tipos) |
| 7 | ux-designer | Revisão de UI do PR 2 (T1 a T4, P15, P16, P18) em 320, 360 e 1280 px, nos temas claro e escuro, com teclado virtual e leitor de tela | — | — | 01 a 20, 35 a 38 | 6 |
| 8 | qa | - Testes de componente: UX-01, 02, 04 a 09, 14, 15 (só o diálogo), 17 a 20 e 35;<br>- Playwright: UX-03, 10, 11, 12, 13 (resposta simulada), 16, 19, 36 e 37 (axe);<br>- com a stack local: a troca obrigatória e a voluntária de ponta a ponta, a RN-16 com dois contextos;<br>- `getByLabel(…, { exact: true })` (AQ-9). | `src/**/*.test.tsx`, `e2e/senha-propria.spec.ts` | 08 a 13, 15, 16 | 01 a 20, 35 a 38 | 6 |
| **PR 3: redefinição e cadastro (cadastro, lista, Funções e Auditoria)** | | | | | | |
| 9 | frontend-developer | - `src/lib/auth/temporary-password.ts` e `src/lib/members/password-row.ts`, com Vitest;<br>- `use-password-reset` (`gcTime: 0`, `abortSignal` de 20 s);<br>- `ResetPasswordDialog` (T6, com a P17 em `TemporaryPasswordView`);<br>- `MemberPasswordRow` (T5);<br>- `MemberForm`: a linha "Senha", "Alterar minha senha" no próprio cadastro, a senha inicial em Acesso com a política e as recusas da AQ-8; saem o botão "Alterar Senha", o diálogo "Nova Senha" e a chamada à `change-member-password`;<br>- `Members.tsx`: "Redefinir senha" no `RowActionsMenu`;<br>- `src/lib/members/fields.ts` com `password_reset_status`;<br>- `src/lib/access/permissions.ts`: rótulo e dica (T7);<br>- `src/lib/audit/auth-events.ts` e `Events.tsx` (T8). | `src/lib/auth/temporary-password.ts`, `src/lib/members/{password-row,fields}.ts`, `src/hooks/use-password-reset.ts`, `src/components/members/{ResetPasswordDialog,MemberPasswordRow}.tsx`, `src/components/MemberForm.tsx`, `src/pages/{Members,Events}.tsx`, `src/lib/access/permissions.ts`, `src/lib/audit/auth-events.ts` | 01 a 07, 13, 17 | 21 a 34, 39 | 6 mergeado (usa `PasswordInput` e o diálogo da T3) |
| 10 | ux-designer | Revisão de UI do PR 3 (T5 a T8, P17) em 320, 360 e 1280 px, nos temas claro e escuro, com leitor de tela | — | — | 21 a 34, 36 a 39 | 9 |
| 11 | qa | - Testes de componente: UX-15 (no cadastro), 21 a 28, 30 a 34, 38 e 39;<br>- Playwright: UX-24 e 26 (área de transferência e DOM), 29 (`sr-only`), 36 e 39 em *viewport*;<br>- com a stack local e a massa: RN-01 a RN-07 pela tela;<br>- inspeção no Chrome do Android (UX-30). | `src/**/*.test.tsx`, `e2e/redefinicao-senha.spec.ts` | 01 a 07, 13, 17 | 21 a 34, 36 a 39 | 9 |
| **PR 4: portão, Líder e marca na publicação (banco)** | | | | | | |
| 12 | backend-developer | Migration 5:<br>- `viewer_member_id`, `viewer_has` e `default_role_id` com o portão, copiando os corpos finais do E2.02;<br>- qualquer outra função que o teste de catálogo apontar;<br>- a Líder com `change_member_password`;<br>- a marca na publicação com a Auditoria (DT-13);<br>- `DROP FUNCTION public.is_admin(uuid)` se nenhuma política nem corpo `plpgsql` a usar (busca em `pg_proc.prosrc` e `pg_policies`).<br><br>Deixar na descrição do PR o SQL de rollback (risco 1). Regenerar o `types.ts`. | `supabase/migrations/<ts>_e203_05_gate.sql`, `src/integrations/supabase/types.ts` | 01, 08, 09, 16 | dados de 03, 13 | PRs 2 e 3 **promovidos em produção** |
| 13 | qa | - pgTAP do PR 4: o teste de catálogo do portão, `session_ended` com o token de uma sessão apagada, a Líder com a permissão e a marca na publicação;<br>- volume com `EXPLAIN` (risco 3);<br>- Playwright: UX-03 e UX-13 contra o banco real, e a RN-09 e a RN-16 com dois contextos;<br>- depois do "Deploy: banco" e com autorização do usuário, *smoke* em produção só com contas de teste: login, troca obrigatória de uma conta com `123456` e redefinição por uma Líder de teste. | `supabase/tests/database/e203_gate.test.sql`, `e2e/portao-senha.spec.ts` | 01, 08, 09, 16 | 03, 13 | 12 |
| B | usuário | Passo B: "Deploy: banco" do PR 4 fora das noites de célula, quando os relatórios são lançados (P-SEN-24) | — | 08, 09 | — | 12 mergeado |
| **Fechamento** | | | | | | |
| 14 | architect | Revisão final dos 4 PRs:<br>- atualizar o `CLAUDE.md` (estado atual, armadilhas, deploy e problemas conhecidos);<br>- registrar no E1.04 a `sign_in_attempt` sobre o cofre, o `must_change_password`, o `_shared/` e o fim do `set_random_and_flag`;<br>- registrar no E2.01 o fim do plano B do risco 1;<br>- registrar no E2.02 o fim do risco 12 e a remoção de `is_admin`.<br><br>O aceite, a matriz de paridade e o `docs/migracao.md` são do `product-owner`. | `CLAUDE.md`, `docs/specs/e1-04-sign-in.md`, `docs/specs/e2-01-exclusao-logica.md`, `docs/specs/e2-02-perfis-escopo.md` | — | — | 5, 7, 8, 10, 11, 13 |

**Ordem de execução:**
- **PR 1:** 1 → 2 → 3 → 4. A 5 é escrita em paralelo com a 2, a 3 e a 4 e roda depois da 4. Depois do "Deploy: banco", passo A.
- **PR 2:** 6 → (7 ∥ 8). Merge e promote.
- **PR 3:** 9 (depois do merge do PR 2) → (10 ∥ 11). Merge e promote.
- **PR 4:** 12 (depois dos PRs 2 e 3 promovidos) → 13. Passo B.
- **Fechamento:** 14 no fim.
- **Com os outros passos:** o E2.03 só começa depois do E1.04 (PRs 1 a 3), do E2.01 (PRs 1 a 6) e do E2.02 (PRs 1 a 6) em produção.

**Critérios de pronto**
1. **Todas as tarefas de banco:**
   - as migrations rodam num banco zerado depois das existentes e rodam de novo sem erro;
   - nenhuma função nova tem EXECUTE para `anon`;
   - as internas não têm EXECUTE para ninguém além do dono;
   - o `types.ts` está regenerado;
   - os testes do E1.04, do E2.01 e do E2.02, atualizados, continuam passando.
2. **Tarefa 2:** a tabela de casos cobre todos os critérios da RN-13, da RN-07 e o UX-08. A migration 2 falha cedo, sem mudar nada, num banco sem os três passos anteriores.
3. **Tarefa 3:**
   - depois da migration 3, `auth.users` não tem nenhuma senha, e o login pela `sign_in_attempt` continua aceitando as mesmas senhas;
   - nenhuma linha do cofre tem outra coisa além de bcrypt;
   - nenhum evento contém senha.
4. **Tarefa 4:**
   - nenhum log das funções contém senha, token, e-mail ou origem;
   - a `create-user-admin` nunca chama `createUser` com senha;
   - um "Deploy: banco" de qualquer commit não publica mais a `change-member-password`;
   - o workflow falha com uma senha em `auth.users`.
5. **Tarefa 5:**
   - todos os critérios "pela API" das RN-01 a RN-08 e RN-10 a RN-17 passam na stack local;
   - os cenários de concorrência terminam com exatamente 20 redefinições e 5 conferências.
6. **Tarefas 6 e 9:**
   - `npm run lint`, `npm test` e `npm run build` verdes;
   - sem `any` e sem asserção de tipo (`as Tipo`) nos arquivos novos ou tocados (`as const` é permitido);
   - nenhum texto do spec fora de `src/lib/auth/password-texts.ts` e dos módulos de domínio;
   - nenhuma regra de senha dentro de componente;
   - a senha temporária não fica no DOM, no cache do React Query, no `localStorage`, no `sessionStorage`, na URL nem no console depois de "Concluir";
   - nenhuma chamada à `change-member-password`.
7. **Tarefa 12:**
   - o teste de catálogo passa;
   - as metas de volume do risco 3 são cumpridas;
   - o SQL de rollback está na descrição do PR.
8. **Tarefas 7 e 10:** o `ux-designer` dá o veredito e lista os ajustes, que voltam ao `frontend-developer` antes de o QA fechar o PR.
9. **Tarefa 13:** o *smoke* de produção é feito só com contas de teste.

## Testes
_Seção do `qa`._

| RN | Testes | Resultado |
|---|---|---|
| RN-01 | PR 1: `e203_03_reset` (Gerente, Caio, Hugo, Apoio, `password_reset_status`), `e203_01_structure_grants` | passou |
| RN-02 | PR 1: `e203_03_reset` (alcance, função, Nina excluída, Lauro, própria senha, ordem, DA-1, DA-2, restauração) | passou |
| RN-03 | PR 1: `e203_03_reset` (1.000 senhas, formato, validade, login pelos 3 identificadores) | passou |
| RN-04 | PR 1: `e203_03_reset`, `e203_concurrency.sh` (duas redefinições do mesmo alvo) | passou |
| RN-05 | PR 1: `e203_03_reset` (antes e depois do prazo, motivo, contagem), `e203_05_marks_initial` | passou (só por `temp_expires_at`, sem relógio simulado) |
| RN-06 | PR 1: `e203_03_reset` (21ª com 8 min, recusas não contam), `e203_concurrency.sh` (25 → 20) | passou |
| RN-07 | PR 1: `e203_02_policy` (casos `initial`), `e203_05_marks_initial`, `e203-password.edge` (`create-user-admin`) | passou |
| RN-08 (b) | PR 1: `e203_05_marks_initial`, `e203-password.edge` (`sign-in`) | passou |
| RN-10 | PR 1: `e203_04_change` (`forced`, `not_flagged`, `forbidden`, DA-13), `e203-password.edge`, `e203_concurrency.sh` (duas sessões) | passou |
| RN-11 | PR 1: `e203_04_change`, `e203-password.edge` | passou |
| RN-12 | PR 1: `e203_04_change` (5 erros, bloqueio, DA-8 com 45 + 5), `e203-password.edge` (429, `Retry-After`, origem forjada), `e203_concurrency.sh` (20 → 5) | passou |
| RN-13 | PR 1: `e203_02_policy` (75 casos, com os `server_only`), `password-policy-cases-sync` (Vitest) | passou |
| RN-14 | PR 1: `e203_01_structure_grants`, `e203-password.edge` (caminho único contra o Auth da stack) | passou |
| RN-15 | PR 1: `e203-password.edge` (`/recover` não muda a senha) | passou |
| RN-16 | PR 1: `e203_03_reset`, `e203_04_change`, `e203_05_marks_initial` (`my_password_status` com sessão apagada), `e203_concurrency.sh` | passou (portão nas views: PR 4) |
| RN-17 | PR 1: `e203_03_reset`, `e203_04_change` (sem senha, hash ou origem; `CHECK` em `events`), `e203-password.edge` (logs) | passou |
| RN-08 (c), RN-09 | PR 4 | — |

PR 1 (stack `mci-b`, 2026-11-26): `supabase test db` 42 arquivos e 4.093 testes, PASS; `e203_concurrency.sh`, `e104_concurrency.sh` e `e203_migrations.sh` PASS; edge 21/21 + 21/21 (rodar um arquivo por vez); Vitest 1.719, tsc e build OK; lint só com os 3 erros antigos da `main`; Playwright inteiro 284 passaram, com uma falha de dados (UX-19 de `excluidos-membros.spec.ts`, sem células na stack) sem relação com o PR. Não verificados: a migration 2 num banco sem os passos anteriores e o volume do risco 3 (`EXPLAIN`), que ficam para o PR 4.
