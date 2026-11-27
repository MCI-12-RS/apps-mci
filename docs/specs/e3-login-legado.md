# E3: Login com a senha do legado (E3.01 a E3.05)

> Status: Negócio em rascunho. E3.01 a E3.03 prontas para o `architect`, exceto o caso de borda da Q-4 (RN-05) e o lugar do número da RN-14 (Q-5); RN-18 e RN-19 (liderança) dependem das Q-1 a Q-3.
> Slug: `e3-login-legado` · Paridade com o legado: sim (AUT-01, 6.3), sem prazo (D6)

<!--
Tamanho máximo: 60 KB no total (confira com `wc -c`).
- Negócio: até 20 KB. Experiência (UX): até 15 KB. Solução técnica e Tarefas: até 20 KB. Testes: até 5 KB.
-->

## Negócio
_Seção do `product-owner`._

Abreviações dos caminhos do legado (como no E1.04): `App/` = `G12App.Application/`, `Domain/` = `G12App.Domain/`, `Infra/` = `G12App.Infrastructure.Data/`, `UI/` = `G12App.API/ClientApp/src/`. "6.x" e "5.x" são seções do `docs/migracao.md`.

### Contexto e objetivo
Na virada, todo membro que já usava o legado precisa entrar no novo com **a mesma identificação e a mesma senha de sempre**, sem pedir nada a ninguém (6.3, objetivo da seção 1). O legado guarda só o MD5 da senha (6.1), que o novo não aproveita direto. Por isso, a senha antiga é conferida uma vez, na primeira entrada, e a partir daí passa a ser a senha do novo.

Este spec cobre:
- **E3.01:** a credencial legada (o que é, quem tem, quando some);
- **E3.02:** a primeira entrada com a senha antiga, no ponto que o E1.04 deixou pronto (RN-17 do E1.04), com a política e a troca obrigatória do E2.03 (RN-08 d, RN-13, DA-16 do E2.03);
- **E3.03:** os casos que os testes precisam provar;
- **E3.04 e E3.05** (liderança): só o que precisa ser entregue (RN-18, RN-19).

O que o legado faz (confirmado no código):
- O MD5 é calculado **no navegador**, sobre a senha **exatamente como digitada** (sem `trim`, sem mudar maiúsculas), tanto no login (`UI/pages/Login/index.js:40`; o `trim` da linha 39 é só na identificação) quanto no cadastro e na troca (`UI/pages/Members/details.js:224`).
- A biblioteca é o pacote `md5` 2.3.0 (`UI/../package-lock.json:28066`): converte o texto para **UTF-8** (`encodeURIComponent`) e devolve **hexadecimal minúsculo**. Não há normalização Unicode: "café" digitado com o "é" composto e com o "e" + acento separado dá hashes diferentes. Conferido rodando o pacote: igual ao MD5 UTF-8 padrão, inclusive com acento e espaços nas pontas.
- A API guarda o que recebe e compara **texto igual, diferenciando maiúsculas** (`App/Services/AuthService.cs:65`). Um hash guardado em outro formato nunca funcionou no legado.
- A senha só é gravada quando vem preenchida, pelo próprio membro ou por administrador (`Domain/Mappings/DomainToDTOMappingProfile.cs:45-50`); é obrigatória só na criação pela tela (`UI/pages/Members/details.js:165-166`). Não há política de senha: qualquer senha não vazia vale, inclusive `123456` e de um caractere.
- O login busca entre os não excluídos (`Infra/Repositories/MemberRepository.cs:48`), por celular igual ou e-mail sem diferenciar maiúsculas (`Domain/Extensions/QueryingExtensions.cs:61-62`), e não olha "inativo".

### Personas e permissões
- **Membro que vem do legado**: tem conta criada pela carga (6.2), ainda sem senha no novo, e uma credencial legada pendente. Qualquer função (Administrador, Líder, Membro), inclusive pastor, inativo e sem liderança: entrar não depende de permissão (RN-06 do E1.04).
- **Membro que já entrou no novo**: a credencial legada não existe mais; vale só a senha do novo.
- **Quem redefine senha** (`change_member_password`, E2.03): continua sendo o caminho de quem não consegue entrar.
- **Quem audita** (`view_audit_log`): vê os registros da RN-13.
- **Liderança**: entrega a lista de funções (E3.04) e aprova a comunicação (E3.05).

### Histórias
- Como membro que vem do legado, quero entrar com a identificação e a senha de sempre, para não depender de ninguém no primeiro dia.
- Como membro com senha simples (ex.: `123456`), quero ser levado a criar uma senha nova logo ao entrar, sem perder o acesso se eu sair antes de trocar.
- Como líder, quero que quem não consegue entrar fale comigo e receba uma senha temporária, como já acontece no novo.
- Como liderança, quero saber quantos ainda não fizeram o primeiro acesso, para o plantão de suporte (7.2, E6.07).

### Regras de negócio
| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Quem recebe credencial legada.** Na carga, recebe credencial o membro que: (a) não está excluído no legado; (b) recebe conta de acesso (6.2: tem identificador real); (c) tem no legado uma senha **utilizável**: 32 caracteres hexadecimais minúsculos, diferente do MD5 do texto vazio; (d) ainda não tem senha no novo (RN-03). Quem não cumpre (c) entra na lista "sem senha" do inventário (5.4) e segue a RN-08. A credencial nunca guarda a senha nem o MD5 legível: um vazamento dela não pode virar credencial no legado nem no novo. | 6.2, 6.3 (item 1 e "A validar pelo architect"), 5.4 ("Membros sem senha"); formato: legado (`AuthService.cs:65`, pacote `md5`); MD5 vazio: definida pelo spec (P-LEG-01) |
| RN-02 | **Conferência igual à do legado.** A senha digitada é usada exatamente como veio (RN-09 do E1.04): o MD5 é calculado sobre os bytes UTF-8 dela, sem tirar espaços, sem mudar maiúsculas e **sem normalizar acentos**, e comparado com o do legado. Uma senha com acento confere quando o aparelho envia o acento da mesma forma que enviou no legado. Uma senha que o legado não conseguia calcular (texto inválido) nunca confere. | legado (`UI/pages/Login/index.js:40`, `UI/pages/Members/details.js:224`, pacote `md5` 2.3.0); 6.3 item 2; sem normalização: definida pelo spec (P-LEG-02) |
| RN-03 | **Uma senha valendo por vez.** Enquanto a conta tem credencial legada, ela é a única senha conferida no login. A credencial some, na mesma operação, quando uma senha é gravada no novo por qualquer caminho: a primeira entrada (RN-04), a redefinição (RN-04 do E2.03) ou a troca. Uma carga refeita (ensaio ou cutover) **não recria** credencial para conta que já tem senha no novo. | 6.3 ("apaga a credencial legada"); RN-04 do E2.03; DT-14 do E1.04; carga refeita: definida pelo spec (P-LEG-03) |
| RN-04 | **Primeira entrada com a senha certa.** A identificação segue o E1.04 sem mudança (RN-01 a RN-06 de lá): e-mail real, celular ou CPF, inclusive o CPF que o legado não aceitava (D5) e o celular com ou sem máscara. Quando a senha confere (RN-02): (a) ela é gravada como a senha do novo, **como foi digitada**; (b) a credencial legada é apagada; (c) a pessoa entra e recebe a sessão, como num login comum. Tudo na mesma operação: se a gravação falhar, a pessoa não entra e a credencial continua. | 6.3 itens 3 e 4; DA-16 do E2.03; RN-17 do E1.04 |
| RN-05 | **Senha antiga fora da política.** Se a senha certa não atende à política (RN-13 do E2.03, sem a regra "h"), a pessoa **entra** e recebe a marca de troca obrigatória (motivo `legacy_weak`), na mesma operação da RN-04. Daí em diante valem as RN-09 e RN-10 do E2.03: só a tela de troca, nada pela API, e a nova senha diferente da antiga. Se sair sem trocar, a próxima entrada com a mesma senha volta à troca, sem novo registro "Troca de senha exigida". Vale para a `123456` e para qualquer senha curta, comum ou com dados do próprio membro. Nunca há recusa de login por causa da política. Senha antiga acima de 72 bytes: a confirmar (Q-4). | 6.3 item 3; RN-08 (b, d) e DA-16 do E2.03; RN-17 do E1.04 |
| RN-06 | **Senha errada.** A credencial continua, nada é gravado, a resposta é a mensagem única do E1.04 (RN-07 h), com o mesmo tempo, e a falha conta nos limites por identificação e por origem (RN-10 a RN-12 do E1.04), como qualquer senha errada. A Auditoria registra "Senha incorreta" (RN-13). | RN-07, RN-10 a RN-12 e RN-17 c do E1.04 |
| RN-07 | **Sem prazo.** A credencial legada vale até a primeira entrada com sucesso ou até uma redefinição (RN-03), sem data para acabar, inclusive depois do desligamento do legado. Não há apagamento em lote. | D6; 6.3; 7.4 |
| RN-08 | **Sem senha utilizável no legado.** Quem tem conta mas não tem credencial nem senha no novo (RN-01 c) não entra com nenhuma senha: recebe a mensagem única (RN-07 do E1.04), a tentativa conta nos limites, e a Auditoria registra o motivo novo "Sem senha definida" (ligado ao cadastro), para o líder saber que o caminho é a redefinição assistida (6.4). Não existe senha padrão para esse caso: a `123456` da D11 vale só para cadastro feito no novo. | 5.4 ("precisam de redefinição"); 6.4; D11; motivo próprio: definida pelo spec (P-LEG-04) |
| RN-09 | **Excluído no legado.** Não recebe conta nem credencial (6.2, 6.3). No login, é "Cadastro excluído" (RN-07 d do E1.04). Se for restaurado no novo (DEL-09), a conta é criada na restauração (E4.08), sem credencial: entra pela redefinição. | 6.2; 6.3 item 1; DEL-09 |
| RN-10 | **Excluído no novo depois da carga.** A exclusão não apaga a credencial pendente. Enquanto excluído, não entra (RN-06 do E1.04). Restaurado, a senha antiga volta a valer, se ainda não foi usada, como a restauração devolve a senha do novo (RN-16 f do E2.01). | DEL-09; RN-14 do E2.01; coerência: definida pelo spec (P-LEG-05) |
| RN-11 | **A senha antiga depois da primeira entrada.** Ela passa a ser a senha do novo (RN-04 a) e continua valendo até a pessoa trocá-la (RN-10 e RN-11 do E2.03) ou alguém redefini-la. Fora da política, ela vale só para chegar à troca obrigatória (RN-05). Depois de uma troca, a senha antiga para de funcionar. | 6.3; RN-08, RN-10, RN-11 do E2.03 |
| RN-12 | **Entradas simultâneas.** Duas entradas ao mesmo tempo com a senha antiga certa (dois aparelhos) entram as duas; a senha é gravada uma vez e há um só registro de primeiro acesso. Uma redefinição concluída antes da entrada faz a senha antiga falhar; uma entrada concluída antes da redefinição é desfeita por ela (vale a última, RN-04 do E2.03). | RN-04 do E2.03; definida pelo spec (P-LEG-06) |
| RN-13 | **Auditoria** (servidor, como no E1.04 e no E2.03). (a) Primeira entrada: o "Login realizado" de sempre, com a informação "Senha do sistema antigo"; (b) com a marca, também "Troca de senha exigida", motivo "Senha fora das regras" (RN-17 f do E2.03); (c) falha com a credencial legada: "Senha incorreta", com a mesma informação de (a); (d) RN-08: "Sem senha definida"; (e) bloqueios como no E1.04. Nunca vão para a Auditoria, os logs ou as respostas: a senha, o MD5, qualquer hash, a identificação completa e a origem. | RN-15 do E1.04; RN-17 do E2.03; 6.3 (Controles); marca de senha antiga: definida pelo spec (P-LEG-07) |
| RN-14 | **Acompanhamento.** É possível saber, a qualquer momento, quantas credenciais legadas foram carregadas e quantas continuam pendentes (a "porcentagem de senhas migradas" do plantão), sem ler nenhum hash e sem identificar ninguém por esse número. Onde esse número aparece depende da Q-5. | 6.3 (Controles); 7.2 (D+1 a D+30); E6.07 |
| RN-15 | **Superusuário do legado.** O `AdminUser` da configuração não migra e não entra no novo (6.6). | 6.6; legado (`AuthService.cs:36-44`) |
| RN-16 | **Contas que já existem no novo.** (a) Quem já tem senha no novo quando a carga roda (por exemplo, os administradores atuais) fica com ela, sem credencial legada (RN-03). (b) Se essa pessoa também existe no legado, a ligação entre os dois cadastros segue a carga (E4.08); a senha do novo continua valendo. | RN-03; 6.2 ("só religa"); (b) a confirmar com o `architect` no E4.08 |
| RN-17 | **Ensaios.** A senha gravada por uma primeira entrada num ensaio se perde na limpeza; na carga final, vale de novo a senha do legado (5.7). | 5.7 |
| RN-18 | **Entrega da liderança: funções (E3.04).** Antes do go/no-go (7.1): a lista de quem fica Administrador e Líder, revisada e aprovada pelos pastores, com **pelo menos 2 Administradores**, todos membros reais, não excluídos e com identificador de login (6.2). Formato e critério: Q-1. | 6.5; 6.6; 7.1; E3.04 |
| RN-19 | **Entrega da liderança: comunicação (E3.05).** Texto aprovado pela liderança, com: o endereço novo; login e senha iguais aos de antes, agora também pelo CPF, e celular e CPF com ou sem pontuação; sem prazo para o primeiro acesso (D6); senha simples pede uma nova no primeiro acesso, com as regras da RN-13 do E2.03 em linguagem simples; depois de muitas tentativas erradas, esperar 15 minutos; quem não consegue entrar (inclusive quem nunca teve senha ou entrava por um e-mail que deixou de valer) fala com o próprio líder, que gera uma senha temporária de 7 dias. Canal e datas: Q-2. | 6.7; Impactos do E1.04 (E3.05) e do E2.03 (E3.05) |

### Critérios de aceite
Massa (contas de teste do E3.03; senhas só de exemplo): Ana (só celular, senha `Graça2024!`, com "ç" composto), Bruno (só CPF, senha `123456`), Carla (e-mail e celular, senha ` mesa azul ` com espaços nas pontas), Davi (sem senha utilizável), Edu (excluído no legado), Fábio e Gabi (casal, cada um com a sua senha).

- **RN-02, RN-04 (acento, só celular)**
  - Dado Ana com credencial legada e o celular só no cadastro
  - Quando entra com o celular, com ou sem máscara, e `Graça2024!`
  - Então entra sem troca obrigatória, a credencial some e a próxima entrada com a mesma senha funciona sem credencial.
  - E com `Graca2024!` (sem cedilha) ou com o "ç" decomposto: "Senha incorreta", credencial mantida.
- **RN-02 (espaços)**
  - Dado Carla, quando entra com `mesa azul` (sem os espaços) → falha; com ` mesa azul ` → entra.
- **RN-04, RN-05 (só CPF, fora da política)**
  - Dado Bruno, que no legado não podia entrar pelo CPF
  - Quando entra pelo CPF, com ou sem pontos, e `123456`
  - Então entra, vai para a troca obrigatória, nada além dela responde pela API, e a Auditoria tem "Login realizado" (senha do sistema antigo) e "Troca de senha exigida", motivo "Senha fora das regras".
  - Quando sai sem trocar e entra de novo com `123456`: volta à troca, sem novo "Troca de senha exigida".
  - Quando troca para `123456`: recusado (RN-10 do E2.03). Depois de trocar para uma senha válida, `123456` falha.
- **RN-06**
  - Dado Ana com credencial, quando erra a senha 5 vezes em 15 minutos, então a 5ª já recebe a mensagem de bloqueio, a credencial continua e, durante o bloqueio, nem a senha certa entra.
  - A resposta e o tempo da senha antiga errada são iguais aos de "senha errada" de uma conta comum (RN-07 do E1.04).
- **RN-08**: Dado Davi com conta e sem credencial, quando entra com qualquer senha, inclusive `123456`, então mensagem única, a tentativa conta e a Auditoria registra "Sem senha definida". Depois da redefinição (E2.03), entra com a temporária.
- **RN-09**: Edu não tem conta; a entrada dá mensagem única e "Cadastro excluído".
- **RN-10**: Dado Ana excluída no novo antes do primeiro acesso, quando tenta → "Cadastro excluído"; restaurada, entra com `Graça2024!`.
- **RN-03, RN-12 (redefinição)**: Dado Bruno com credencial, quando um líder redefine a senha dele e depois ele entra com `123456` → falha; com a temporária → entra.
- **RN-03 (carga refeita)**: Dado Carla que já entrou no novo, quando a carga roda de novo, então ela continua sem credencial e ` mesa azul ` continua valendo (fora dos ensaios com limpeza, RN-17).
- **RN-12 (simultâneas)**: 2 entradas simultâneas de Ana com a senha certa entram as duas, com um só registro de primeiro acesso.
- **Casal**: Fábio entra com a senha dele; a credencial de Gabi continua e só a senha de Gabi entra na conta dela.
- **Inativo e pastor**: entram como os demais (RN-06 do E1.04); sem liderança também.
- **RN-13**: em nenhum registro de Auditoria, log da função ou resposta aparecem a senha, o MD5 ou o hash; o painel mostra a identificação mascarada.
- **RN-14**: depois das primeiras entradas de Ana e Bruno, o número de pendentes cai em 2 e o de carregadas não muda; a entrada de Davi não muda nenhum dos dois.

### Fora de escopo
- Tela nova: a primeira entrada usa o login do E1.04 e a troca obrigatória do E2.03 sem mudar texto. Um texto de boas-vindas específico do primeiro acesso não está pedido.
- A criação das contas e a carga das credenciais (E4.08), o inventário e as listas do saneamento (E4.04, E4.05).
- Recuperação de senha por e-mail (E1.07 fora do plano).
- Login do `AdminUser`, desbloqueio manual e qualquer prazo de expiração da credencial (D6, E7.01 não será feito).
- Aceitar variações da senha (sem acento, maiúsculas, sem espaços): o legado também não aceitava.

### Perguntas em aberto
- **Q-1 (E3.04, liderança). Como montar a lista de funções?** O mapeamento automático da 6.5 põe como Líder todo `AppAdmin` do legado, e a Líder do novo faz mais que o `AppAdmin` fazia: redefine senha de quem está no ministério (E2.03). *Recomendação:* gerar a lista a partir do legado pela 6.5, por G12, e a liderança marcar quem sobe ou desce (sem montar do zero); aprovar com os pastores; pelo menos 2 Administradores, de preferência um deles fora do casal pastoral.
- **Q-2 (E3.05, liderança). Canal, remetente e datas da comunicação.** *Recomendação:* WhatsApp, enviado pelos pastores aos G12 e repassado pelos líderes às células, no D−7 (7.2), com um lembrete no D0 depois do go/no-go; o texto final passa pelo PO.
- **Q-3 (liderança). Avisar antes quem não vai conseguir entrar sozinho?** São os membros sem senha utilizável (RN-08) e os sem identificador real (5.4). *Recomendação:* sim: a lista, por G12 e com o nome do líder direto, vai a cada líder antes do D0, para a redefinição assistida já no primeiro dia.
- **Q-4. Senha antiga acima de 72 bytes** (cerca de 72 letras sem acento): ela confere no MD5, mas o novo não guarda senha desse tamanho (RN-13 a do E2.03; DA-5 do E1.04). *Recomendação:* tratar como as demais fora da política se o `architect` conseguir sem quebrar a RN-04 (entra e troca); se não, falha com "Senha incorreta" e o caminho é a redefinição. É raro e o inventário não consegue detectar (só há o hash).
- **Q-5. Onde a liderança vê o número da RN-14?** *Recomendação:* sem tela nova: a operação tira o número por consulta e informa no plantão (E6.07). Um card no Dashboard fica para depois, se pedido.

### Pontos para o `architect`
1. **MD5 no servidor:** UTF-8 dos bytes recebidos, hexadecimal minúsculo, sem normalização Unicode (NFC e NFD dão hashes diferentes). Texto com *surrogate* isolado não confere (o legado lançava erro). Tentar variantes custaria um bcrypt a mais por tentativa (DT-07 do E1.04); por isso a RN-02 não tenta.
2. **Formato guardado:** `bcrypt(md5)`, custo 10 (Dependências do E1.04, E3.01), recriando a `private.discard_legacy_credential` (E3.01 no E2.03). Na carga, só hash de 32 hex minúsculos e diferente de `d41d8cd98f00b204e9800998ecf8427e` (MD5 vazio); o resto vai para a lista "sem senha".
3. **Ordem na `sign_in_attempt`:** credencial legada no lugar do bcrypt da conta (um bcrypt por tentativa); conta sem linha no cofre mas com credencial é "disponível" para esse caminho; sem os dois, o motivo novo `no_password` (RN-08), com o mesmo tempo (RN-07 do E1.04). Mudam a tabela de motivos e os textos de Auditoria do E1.04 e o pgTAP do `e203_06_gate` se algo novo ficar fora do portão.
4. **Uma transação:** gravação no cofre (`private.write_password`), marca `legacy_weak`, apagamento da credencial e Auditoria (DA-16 do E2.03). Concorrência da RN-12 (duas entradas; entrada × redefinição).
5. **Carga refeita e ensaios** (RN-03, RN-16, RN-17): não recriar credencial de quem tem senha no cofre; a limpeza do ensaio apaga também as senhas gravadas nele; definir no E4.08 o caso RN-16 (b).
6. **Exclusão e restauração** (RN-10): a credencial não é tocada pela `delete_member`/`restore_member`.
7. **RN-14:** contagem de pendentes sem expor hash (por exemplo, uma função só para `service_role`), e a reconciliação 5.6 conferir credenciais carregadas = contas com senha utilizável.
8. **Testes E3.03** com a massa dos Critérios, incluindo a conferência do MD5 por uma tabela de casos (com acento composto e decomposto, espaços, emoji, `123456`) gerada pelo pacote `md5` 2.3.0, para amarrar o servidor ao legado.
