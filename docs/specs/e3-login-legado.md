# E3: Login com a senha do legado (E3.01 a E3.05)

> Status: Negócio, Experiência (UX), Solução técnica e Tarefas prontos (2026-11-27). Negócio: Q-1, Q-3, Q-4 e Q-5 respondidas pelo usuário. UX: pendências PO-UX-1 a PO-UX-4 (texto e posição do card), que não bloqueiam. Próximo: PR 1 (banco).
> Slug: `e3-login-legado` · Paridade com o legado: sim (AUT-01, 6.3), sem prazo (D6) · Pendências só da liderança (Q-2, Q-6), que não bloqueiam a implementação.

<!--
Tamanho máximo: 60 KB no total (confira com `wc -c`).
- Negócio: até 20 KB. Experiência (UX): até 15 KB. Solução técnica e Tarefas: até 20 KB. Testes: até 5 KB.
-->

## Negócio
_Seção do `product-owner`._

Caminhos do legado abreviados como no E1.04 (`App/`, `Domain/`, `Infra/`, `UI/`); "5.x", "6.x" e "7.x" são seções do `docs/migracao.md`.

### Contexto e objetivo
Na virada, todo membro que já usava o legado precisa entrar no novo com **a mesma identificação e a mesma senha de sempre**, sem pedir nada a ninguém (6.3). O legado guarda só o MD5 da senha (6.1), que o novo não aproveita direto. Por isso, a senha antiga é conferida uma vez, na primeira entrada, e a partir daí passa a ser a senha do novo.

Este spec cobre:
- **E3.01:** a credencial legada (o que é, quem tem, quando some);
- **E3.02:** a primeira entrada com a senha antiga, no ponto que o E1.04 deixou pronto (RN-17 do E1.04), com a política e a troca obrigatória do E2.03 (RN-08 d, RN-13, DA-16 do E2.03), e o acompanhamento no Dashboard (RN-14);
- **E3.03:** os casos que os testes precisam provar;
- **E3.04** (funções na carga, RN-18) e **E3.05** (comunicação, RN-19).

O que o legado faz (confirmado no código): MD5 calculado **no navegador** sobre a senha **exatamente como digitada** (`UI/pages/Login/index.js:40`, `UI/pages/Members/details.js:224`; o `trim` é só na identificação), pelo pacote `md5` 2.3.0 (UTF-8, hexadecimal minúsculo, sem normalização Unicode; conferido rodando o pacote); a API compara texto igual, diferenciando maiúsculas (`App/Services/AuthService.cs:65`); senha sem política, gravada só quando preenchida (`Domain/Mappings/DomainToDTOMappingProfile.cs:45-50`); login só entre não excluídos, por celular ou e-mail, sem olhar "inativo" (`Infra/Repositories/MemberRepository.cs:48`, `Domain/Extensions/QueryingExtensions.cs:61-62`).

### Personas e permissões
- **Membro que vem do legado**: conta da carga (6.2), sem senha no novo, com credencial legada pendente; entrar não depende de função nem de permissão (RN-06 do E1.04).
- **Quem redefine senha** (`change_member_password`, E2.03): na virada, os G12 (Líder) e os Administradores (RN-18).
- **Quem vê a igreja toda** (`view_all_church`, a Administrador inclusive): vê o card da RN-14.
- **Quem audita** (`view_audit_log`): vê os registros da RN-13.
- **Pastores**: aprovam a lista de funções (E3.04); a liderança aprova a comunicação (E3.05).

### Histórias
- Como membro que vem do legado, quero entrar com a identificação e a senha de sempre.
- Como membro com senha simples, quero criar uma nova logo ao entrar, sem perder o acesso se sair antes.
- Como líder, quero que quem não consegue entrar fale comigo e receba uma senha temporária, como já acontece no novo.
- Como Administrador, quero ver no Dashboard quantos ainda não fizeram o primeiro acesso, para o plantão de suporte (7.2, E6.07).

### Regras de negócio
| ID | Regra | Origem |
|---|---|---|
| RN-01 | **Quem recebe credencial legada.** Na carga, recebe credencial o membro que: (a) não está excluído no legado; (b) recebe conta de acesso (6.2: tem identificador real); (c) tem no legado uma senha **utilizável**: 32 caracteres hexadecimais minúsculos, diferente do MD5 do texto vazio; (d) ainda não tem senha no novo (RN-03). Quem não cumpre (c) entra na lista "sem senha" do inventário (5.4) e segue a RN-08. A credencial nunca guarda a senha nem o MD5 legível: vazada, não serve de credencial em nenhum dos dois. | 6.2, 6.3, 5.4; legado (`AuthService.cs:65`); MD5 vazio: spec (P-LEG-01) |
| RN-02 | **Conferência igual à do legado.** A senha digitada é usada exatamente como veio (RN-09 do E1.04): o MD5 é calculado sobre os bytes UTF-8 dela, sem tirar espaços, sem mudar maiúsculas e **sem normalizar acentos**, e comparado com o do legado. Uma senha com acento confere quando o aparelho envia o acento da mesma forma que enviou no legado. Uma senha que o legado não conseguia calcular (texto inválido) nunca confere. | legado (`Login/index.js:40`, pacote `md5`); 6.3; sem normalização: spec (P-LEG-02) |
| RN-03 | **Uma senha valendo por vez.** Enquanto a conta tem credencial legada, ela é a única senha conferida no login. A credencial some, na mesma operação, quando uma senha é gravada no novo por qualquer caminho: a primeira entrada (RN-04), a redefinição (RN-04 do E2.03) ou a troca. Uma carga refeita (ensaio ou cutover) **não recria** credencial para conta que já tem senha no novo. | 6.3; RN-04 do E2.03; DT-14 do E1.04; carga refeita: spec (P-LEG-03) |
| RN-04 | **Primeira entrada com a senha certa.** A identificação segue o E1.04 sem mudança (RN-01 a RN-06 de lá): e-mail real, celular ou CPF, inclusive o CPF que o legado não aceitava (D5) e o celular com ou sem máscara. Quando a senha confere (RN-02): (a) ela é gravada como a senha do novo, **como foi digitada**; (b) a credencial é apagada; (c) a pessoa entra como num login comum. Tudo numa operação: se a gravação falhar, não entra e a credencial continua. | 6.3 itens 3 e 4; DA-16 do E2.03; RN-17 do E1.04 |
| RN-05 | **Senha antiga fora da política.** Se a senha certa não atende à política (RN-13 do E2.03, sem a regra "h"), a pessoa **entra** e recebe a marca de troca obrigatória (motivo `legacy_weak`), na mesma operação da RN-04. Daí em diante valem as RN-09 e RN-10 do E2.03: só a tela de troca, nada pela API, e a nova senha diferente da antiga. Se sair sem trocar, a próxima entrada com a mesma senha volta à troca, sem novo registro "Troca de senha exigida". Vale para a `123456`, para qualquer senha curta, comum ou com dados do próprio membro e para a **senha acima de 72 bytes**, que o novo não guarda (RN-13 a do E2.03): ela confere pelo MD5 inteiro e leva à troca como as demais, e nenhuma outra senha (por exemplo, só o começo dela) entra na conta. Nunca há recusa de login por causa da política. | 6.3 item 3; RN-08 (b, d) e DA-16 do E2.03; RN-17 do E1.04; acima de 72 bytes: definida pelo usuário (2026-11-27, Q-4) |
| RN-06 | **Senha errada.** A credencial continua, nada é gravado, a resposta é a mensagem única do E1.04 (RN-07 h), com o mesmo tempo, e a falha conta nos limites por identificação e por origem (RN-10 a RN-12 do E1.04), como qualquer senha errada. A Auditoria registra "Senha incorreta" (RN-13). | RN-07, RN-10 a RN-12 e RN-17 c do E1.04 |
| RN-07 | **Sem prazo.** A credencial legada vale até a primeira entrada com sucesso ou até uma redefinição (RN-03), sem data para acabar, inclusive depois do desligamento do legado. Não há apagamento em lote. | D6; 6.3; 7.4 |
| RN-08 | **Sem senha utilizável no legado.** Quem tem conta mas não tem credencial nem senha no novo (RN-01 c) não entra com nenhuma senha: recebe a mensagem única (RN-07 do E1.04), a tentativa conta nos limites, e a Auditoria registra o motivo novo "Sem senha definida" (ligado ao cadastro). O caminho é a redefinição assistida (6.4, RN-19). Não existe senha padrão para esse caso: a `123456` da D11 vale só para cadastro feito no novo. | 5.4; 6.4; D11; motivo: spec (P-LEG-04) |
| RN-09 | **Excluído no legado.** Não recebe conta nem credencial (6.2, 6.3). No login, é "Cadastro excluído" (RN-07 d do E1.04). Se for restaurado no novo (DEL-09), a conta é criada na restauração (E4.08), sem credencial: entra pela redefinição. | 6.2; 6.3 item 1; DEL-09 |
| RN-10 | **Excluído no novo depois da carga.** A exclusão não apaga a credencial pendente. Enquanto excluído, não entra (RN-06 do E1.04). Restaurado, a senha antiga volta a valer, se ainda não foi usada, como a restauração devolve a senha do novo (RN-16 f do E2.01). | DEL-09; RN-14 do E2.01; spec (P-LEG-05) |
| RN-11 | **A senha antiga depois da primeira entrada.** Ela passa a ser a senha do novo (RN-04 a) e continua valendo até a pessoa trocá-la (RN-10 e RN-11 do E2.03) ou alguém redefini-la. Fora da política, ela vale só para chegar à troca obrigatória (RN-05). Depois de uma troca, a senha antiga para de funcionar. | 6.3; RN-08, RN-10, RN-11 do E2.03 |
| RN-12 | **Entradas simultâneas.** Duas entradas ao mesmo tempo com a senha antiga certa (dois aparelhos) entram as duas; a senha é gravada uma vez e há um só registro de primeiro acesso. Entre entrada e redefinição, vale a última concluída (RN-04 do E2.03). | RN-04 do E2.03; spec (P-LEG-06) |
| RN-13 | **Auditoria** (servidor, como no E1.04 e no E2.03). (a) Primeira entrada: o "Login realizado" de sempre, com a informação "Senha do sistema antigo"; (b) com a marca, também "Troca de senha exigida", motivo "Senha fora das regras" (RN-17 f do E2.03); (c) falha com a credencial legada: "Senha incorreta", com a mesma informação de (a); (d) RN-08: "Sem senha definida"; (e) bloqueios como no E1.04. Nunca vão para a Auditoria, os logs ou as respostas: a senha, o MD5, qualquer hash, a identificação completa e a origem. | RN-15 do E1.04; RN-17 do E2.03; 6.3 (Controles); spec (P-LEG-07) |
| RN-14 | **Card "Primeiro acesso" no Dashboard.** (a) Aparece só para quem tem `view_all_church` (a Administrador inclusive); para os demais não existe, nem vazio. (b) Mostra quantas contas ainda não fizeram o primeiro acesso (credenciais pendentes), de quantas receberam credencial na carga final, e a porcentagem já concluída. (c) Só números, da igreja toda: sem nomes, sem lista, sem abrir listagem ao tocar e sem ler hash. (d) Conta só cadastros não excluídos (DEL-): a exclusão tira a pessoa dos dois números, e a restauração a devolve. (e) A credencial que some por redefinição (RN-03) sai dos pendentes como o primeiro acesso; quem não tem credencial (RN-08) não entra em nenhum dos dois números. (f) O card aparece só enquanto houver pelo menos uma credencial pendente: antes da carga e depois que o último pendente sai, ele some; não há outra data (D6). (g) São os números da reconciliação e do plantão (5.6, 7.2). | 6.3 (Controles); 7.2; E6.07; card: definida pelo usuário (2026-11-27, Q-5); (a) e (f): decisão do PO (2026-11-27) |
| RN-15 | **Superusuário do legado.** O `AdminUser` da configuração não migra e não entra no novo (6.6). | 6.6; legado (`AuthService.cs:36-44`) |
| RN-16 | **Contas que já existem no novo.** (a) Quem já tem senha no novo quando a carga roda (por exemplo, os administradores atuais) fica com ela, sem credencial legada (RN-03). (b) Se essa pessoa também existe no legado, a ligação entre os dois cadastros segue a carga (E4.08); a senha do novo continua valendo. | RN-03; 6.2; (b) a definir pelo `architect` no E4.08 |
| RN-17 | **Ensaios.** A senha gravada num ensaio se perde na limpeza; na carga final, vale de novo a do legado. | 5.7 |
| RN-18 | **Funções na carga (E3.04).** (a) Recebe a **Líder** quem é G12 na árvore carregada: nível 1 (`g12_level` = 1, inclusive abaixo de um topo sem liderança, P-HIE-02 do E2.06), ativo ou inativo. (b) Todos os outros recebem a **Membro** (padrão). O papel do legado (`AppAdmin`, `AppUser`) **não é usado**. (c) **Administrador**: pelo menos 2, membros reais, não excluídos e com identificador de login (6.2), escolhidos pelos pastores; quem está nessa lista recebe a Administrador no lugar de (a) ou (b). (d) Antes do go/no-go (7.1), os pastores aprovam a lista gerada, por G12, com o casal, a situação e o papel do legado só como informação; exceção entra só por essa aprovação. (e) A função não acompanha a árvore: depois da carga, trocar de líder não muda a função de ninguém (a atribuição segue o E2.02). | 6.5 (atualizada em 2026-11-27); 6.6; 7.1; (a), (b): definida pelo usuário (2026-11-27, Q-1); (c): 6.6; os nomes: Q-6 |
| RN-19 | **Comunicação (E3.05).** Texto aprovado pela liderança: o endereço novo; login e senha de antes, agora também pelo CPF, com ou sem pontuação; sem prazo para o primeiro acesso (D6); senha simples pede uma nova no primeiro acesso, com as regras da RN-13 do E2.03 em linguagem simples; depois de muitas tentativas erradas, esperar 15 minutos; **como pedir a redefinição**: quem não consegue entrar (senha esquecida, nunca teve senha ou entrava por um e-mail que deixou de valer) procura o próprio líder, que leva o pedido ao G12 do ministério; G12 e pastores procuram um Administrador; quem redefine gera uma senha temporária de 7 dias, trocada no primeiro acesso. **Sem aviso individual antes** a quem não vai conseguir entrar: descobre no primeiro acesso. Canal e datas: Q-2. | 6.7; Impactos do E1.04 e do E2.03 (E3.05); quem redefine: RN-18; sem aviso prévio: definida pelo usuário (2026-11-27, Q-3) |

### Critérios de aceite
Massa (contas de teste do E3.03; senhas só de exemplo): Ana (só celular, senha `Graça2024!`, com "ç" composto), Bruno (só CPF, senha `123456`), Carla (e-mail e celular, senha ` mesa azul ` com espaços nas pontas), Davi (sem senha utilizável), Edu (excluído no legado), Fábio e Gabi (casal, cada um com a sua senha), Hugo (senha de 80 letras sem acento), Íris (G12, `AppUser` no legado), Júlio (nível 2, `AppAdmin` no legado).

- **RN-02, RN-04 (acento, só celular)**
  - Dado Ana, quando entra pelo celular (com ou sem máscara) e `Graça2024!`, então entra sem troca, a credencial some e a mesma senha continua valendo.
  - Com `Graca2024!` ou o "ç" decomposto: "Senha incorreta", credencial mantida.
- **RN-02 (espaços)**: Dado Carla, quando entra com `mesa azul` (sem os espaços) → falha; com ` mesa azul ` → entra.
- **RN-04, RN-05 (só CPF, fora da política)**
  - Dado Bruno, que no legado não podia entrar pelo CPF
  - Quando entra pelo CPF, com ou sem pontos, e `123456`
  - Então entra, vai para a troca obrigatória, nada além dela responde pela API, e a Auditoria tem "Login realizado" (senha do sistema antigo) e "Troca de senha exigida", motivo "Senha fora das regras".
  - Quando sai sem trocar e entra de novo com `123456`: volta à troca, sem novo "Troca de senha exigida".
  - Quando troca para `123456`: recusado (RN-10 do E2.03). Depois de trocar para uma senha válida, `123456` falha.
- **RN-05 (acima de 72 bytes)**
  - Dado Hugo com credencial, quando entra com as 80 letras → entra e vai para a troca; sai sem trocar e entra de novo com as 80 → volta à troca.
  - Com só as primeiras 72 letras, antes ou depois da primeira entrada → "Senha incorreta". Depois de trocar, as 80 letras falham.
- **RN-06**: Dado Ana, 5 senhas erradas em 15 min → a 5ª já é bloqueio, a credencial continua e nem a certa entra durante o bloqueio; resposta e tempo iguais aos de uma conta comum.
- **RN-08**: Dado Davi com conta e sem credencial, quando entra com qualquer senha, inclusive `123456`, então mensagem única, a tentativa conta e a Auditoria registra "Sem senha definida". Depois da redefinição (E2.03), entra com a temporária.
- **RN-09**: Edu não tem conta; a entrada dá mensagem única e "Cadastro excluído".
- **RN-10**: Dado Ana excluída no novo antes do primeiro acesso, quando tenta → "Cadastro excluído"; restaurada, entra com `Graça2024!`.
- **RN-03, RN-12 (redefinição)**: Dado Bruno com credencial, quando um líder redefine a senha dele e depois ele entra com `123456` → falha; com a temporária → entra.
- **RN-03 (carga refeita)**: Dado Carla que já entrou no novo, quando a carga roda de novo, então ela continua sem credencial e ` mesa azul ` continua valendo (fora dos ensaios com limpeza, RN-17).
- **RN-12 (simultâneas)**: 2 entradas simultâneas de Ana com a senha certa entram as duas, com um só registro de primeiro acesso.
- **Casal**: Fábio entra com a senha dele; a credencial de Gabi continua e só a senha de Gabi entra na conta dela.
- **Inativo, pastor e sem liderança** entram como os demais (RN-06 do E1.04).
- **RN-13**: em nenhum registro de Auditoria, log da função ou resposta aparecem a senha, o MD5 ou o hash; o painel mostra a identificação mascarada.
- **RN-14 (card)**
  - Dado um Administrador, depois das primeiras entradas de Ana e Bruno, o card mostra 2 pendentes a menos e o mesmo total; a entrada de Davi não muda nenhum dos dois; tocar no card não abre lista.
  - Dado Hugo excluído no novo com credencial pendente, os dois números caem em 1; restaurado, voltam.
  - Dado alguém com a função Líder ou Membro (sem `view_all_church`), o card não aparece, nem pela API.
  - Quando a última credencial pendente some, o card desaparece; antes da carga, ele não aparece.
- **RN-18 (funções)**: na carga, Íris recebe a Líder; Júlio, a Membro; um G12 que está na lista de Administradores recebe a Administrador. Depois da carga, Íris troca de líder (deixa de ser G12) e continua Líder.

### Fora de escopo
- Tela nova além do card da RN-14 (login do E1.04 e troca do E2.03 sem mudar texto; sem boas-vindas próprias).
- Aviso individual antecipado a quem não vai conseguir entrar (Q-3, 2026-11-27) e listas de quem está pendente.
- Atribuição automática de função depois da carga (RN-18 e).
- A criação das contas e a carga das credenciais (E4.08), o inventário e as listas do saneamento (E4.04, E4.05).
- Recuperação de senha por e-mail (E1.07 fora do plano).
- Login do `AdminUser`, desbloqueio manual e qualquer prazo de expiração da credencial (D6, E7.01 não será feito).
- Aceitar variações da senha (sem acento, maiúsculas, sem espaços): o legado também não aceitava.

### Perguntas em aberto
Respondidas pelo usuário em 2026-11-27: Q-1 (RN-18), Q-3 (RN-19), Q-4 (RN-05) e Q-5 (RN-14). As que sobram são da liderança, são dados e não bloqueiam a implementação:
- **Q-2 (E3.05). Canal, remetente e datas da comunicação.** *Recomendação:* WhatsApp, enviado pelos pastores aos G12 e repassado pelos líderes às células, no D−7 (7.2), com um lembrete no D0 depois do go/no-go; o texto final passa pelo PO.
- **Q-6 (E3.04). Quem serão os Administradores (pelo menos 2) e se os pastores entram como Administrador.** Fora da lista, o pastor fica Membro (RN-18 b): vê a árvore toda (RN-05 do E2.02), mas não cadastra, não edita nem redefine senha. *Recomendação:* os pastores na lista e pelo menos um Administrador fora do casal pastoral.

### Pontos para o `architect`
1. **MD5 no servidor:** UTF-8 dos bytes recebidos, hexadecimal minúsculo, sem normalização (NFC ≠ NFD); *surrogate* isolado não confere. Variantes custariam um bcrypt a mais (DT-07 do E1.04).
2. **Formato guardado:** `bcrypt(md5)`, custo 10 (E1.04, E3.01), recriando a `private.discard_legacy_credential` (E2.03). Na carga, só 32 hex minúsculos e diferente de `d41d8cd98f00b204e9800998ecf8427e` (MD5 vazio).
3. **`sign_in_attempt`:** credencial legada no lugar do bcrypt da conta (um por tentativa); sem cofre nem credencial, o motivo `no_password` (RN-08), com o mesmo tempo. Mudam os motivos e textos de Auditoria do E1.04 e, se algo ficar fora do portão, o `e203_06_gate`.
4. **Uma transação:** cofre (`private.write_password`), marca `legacy_weak`, credencial e Auditoria (DA-16 do E2.03); concorrência da RN-12.
5. **Carga refeita e ensaios** (RN-03, RN-16, RN-17): não recriar credencial de quem tem senha no cofre; a limpeza do ensaio apaga as senhas gravadas nele; RN-16 (b) no E4.08.
6. **Exclusão e restauração** (RN-10): a credencial não é tocada pela `delete_member`/`restore_member`.
7. **RN-14:** números por função atrás do portão, só para `view_all_church`; o card entra no Dashboard do E2.14 e depende da seção UX. A reconciliação 5.6 confere credenciais carregadas = contas com senha utilizável.
8. **RN-05 acima de 72 bytes:** não cabe no cofre (RN-13 a do E2.03). Entrar com a marca e voltar à troca sem aceitar o começo da senha (truncamento do bcrypt); se impossível, devolver ao PO (vira "Senha incorreta" e redefinição).
9. **RN-18 na carga (E4.08):** função pelo nível depois do `private.rebuild_member_hierarchy()`, com a lista de Administradores como entrada; a reconciliação confere pelo menos 2 com conta.
10. **Testes E3.03:** a massa dos Critérios e uma tabela de casos do MD5 (acento composto e decomposto, espaços, emoji, `123456`, 80 letras) gerada pelo pacote `md5` 2.3.0.

## Experiência (UX)
_Seção do `ux-designer`._

Só o card "Primeiro acesso" do Dashboard (RN-14) tem tela nova. O login (E1.04) e a troca obrigatória (E2.03) não mudam: sem tela nem texto novos, e a pessoa com senha antiga fraca cai na troca do E2.03 como qualquer outra. Os padrões P110 a P114, o P44 e o P6 são os do E2.14 (seção UX, T1 a T7), citados e não copiados. O E2.14 ainda não foi implementado: este card depende da casca dele (seções com `h2`, grade P114, estados P112).

### Fluxo
Quem tem `view_all_church` abre o Dashboard (0 toques, tela inicial), vê o card e lê o número. Não há ação: o card não abre lista, não tem botão e não pede nada. O plantão (7.2) usa o número para saber quantos faltam; quem ajuda uma pessoa específica segue pelo líder e pela redefinição (RN-19). Quem não tem `view_all_church` não vê nada diferente, e o Dashboard fica como no E2.14.

### Tela: card "Primeiro acesso" (T-LG1)
**Onde fica:** numa `section` própria, **entre "Esta semana" e "Geral"** (ordem do DOM e do Tab), com `h2` "Primeiro acesso" e `aria-labelledby`. Motivos: o card de pendentes do E2.14 continua acima da dobra em 360×800 (UX-03 de lá), e o número temporário não rouba o lugar de "Esta semana" nem se perde no fim da página. Como o card é provisório (RN-14 f), a seção inteira some junto, sem deixar vaga.

Celular (360 px), Rita (Administrador), 4 dias depois da virada, 1.240 contas com credencial na carga, 208 ainda pendentes:
```
│ Primeiro acesso                      │  h2
│ ┌──────────────────────────────────┐ │  div (não é link), w-full
│ │ Contas sem primeiro acesso     🔑│ │  text-sm, quebra linha; ícone aria-hidden
│ │                                  │ │
│ │ 208                              │ │  text-3xl font-bold tabular-nums
│ │ de 1.240 contas com a senha do   │ │  text-sm text-muted-foreground
│ │ sistema antigo                   │ │
│ │ ██████████████████████████▒▒▒▒▒▒ │ │  barra h-2, aria-hidden
│ │ 83% já fizeram o primeiro acesso │ │  text-sm, text-foreground
│ └──────────────────────────────────┘ │
```
Computador (≥ 768 px): o mesmo card, `max-w-xl`, alinhado à esquerda, como o gráfico do E2.14 (`max-w-3xl`); mais largo, a barra se afasta dos números. Nenhuma outra mudança de estrutura.

- **Estrutura:** `Card` (`bg-card border`, `rounded-lg p-4`, `space-y-2`), sem `Link`, sem `ChevronRight`, sem hover, sem `cursor-pointer`, fora do Tab (mesmo "sem link" do P110). Título e ícone em `flex items-start justify-between gap-2` (P110); o ícone é o `KeyRound` do `lucide-react`, `h-5 w-5 text-muted-foreground`, `aria-hidden`.
- **Tom: neutro (P111), sempre.** Pendente aqui não é atraso: não há prazo (D6, RN-07). Nada de aviso, de sucesso nem de `destructive`. O número fica em `text-foreground`.
- **Barra:** `div` `aria-hidden` com trilho `bg-muted` e preenchimento `bg-primary` (largura = % já feita, mínimo de 4 px quando maior que zero), `h-2 rounded-full`, sem animação. É só reforço: o texto abaixo diz o mesmo. Nenhum componente novo do shadcn (nem o `Progress`, para não anunciar duas vezes).
- **Números (`formatCount`, "1.240"):**
  - pendentes `N`; total `T` (credenciais da carga final, RN-14 b); já fizeram = `T − N`;
  - porcentagem **arredondada para baixo**, para nunca mostrar "100%" enquanto falta alguém. Se `T − N > 0` e a conta der 0, "Menos de 1% já fizeram o primeiro acesso". Com `T − N = 0`: "0% já fizeram o primeiro acesso";
  - `T` e `N` mudam com exclusão e restauração (RN-14 d); a porcentagem acompanha.
- **Sem nomes, sem lista, sem link** (RN-14 c): nada no card leva a uma pessoa, e não há tooltip.

### Estados
| Estado | O que a pessoa vê |
|---|---|
| Sem `view_all_church` | A seção não existe no DOM (nem `h2`, nem vazio, nem `Skeleton`), e nenhuma consulta é feita. |
| Carregando, primeira vez | Nada do card: ele pode sumir (RN-14 f), então não tem `Skeleton` (P112). Quem pode vê-lo usa a seção "Esta semana" como referência; a seção "Primeiro acesso" entra de uma vez, na mesma resposta que "Geral", sem entrar antes de outro item já na tela. Cada seção em carga segue o `aria-busy` e o "Carregando…" do E2.14 (T7); esta não acrescenta um "Carregando…" próprio, para o leitor não ouvir um aviso de uma seção que talvez não exista. |
| Sem pendentes (0) ou antes da carga | A seção não existe (RN-14 f). Não há "Todos já entraram" nem estado vazio. |
| Com pendentes | O card acima. |
| Atualizando (depois de gravar com o Dashboard aberto, ao voltar para a aba) | Os números de antes ficam com `opacity-60` e `aria-busy="true"`, sem `Skeleton` (P44, P112). Se o último pendente sair, a seção só some quando a resposta chega. |
| Erro ao carregar | Seção com o `h2` e um `Alert` (variante `default`, `CircleAlert`, texto em `text-foreground`) com o texto de erro e "Tentar de novo" (`outline`, `w-full h-11` no celular, `md:w-auto md:h-10`), como no T7 do E2.14: sem `role="alert"` na primeira carga e com ele depois de "Tentar de novo" falhar. Mostrar o erro, e não esconder o card, porque com erro não dá para saber se há pendentes. Nunca texto técnico. |
| A atualização falha | Depois de uma gravação, o `Alert` no lugar dos números (nunca o número de antes de uma gravação, RN-17 do E2.14); ao voltar para a aba, os números ficam, sem aviso. |
| Número grande | "1.240" e "20.000" cabem em 320 px sem corte (`tabular-nums`); o texto "de T contas…" quebra linha, sem `truncate` e sem altura fixa. |

### Textos
| Onde | Texto |
|---|---|
| Seção (`h2`) | Primeiro acesso |
| Título do card | Contas sem primeiro acesso |
| Apoio | de {T} contas com a senha do sistema antigo (com T = 1: de 1 conta com a senha do sistema antigo) |
| Porcentagem | {P}% já fizeram o primeiro acesso · Menos de 1% já fizeram o primeiro acesso |
| Nome acessível (leitura do card) | Contas sem primeiro acesso: {N}, de {T} contas com a senha do sistema antigo. {P}% já fizeram o primeiro acesso. |
| Erro | Não foi possível carregar o primeiro acesso. Verifique a conexão e tente de novo. |
| Botão do erro | Tentar de novo |

Evitar: "credencial", "legado", "MD5", "hash" e "migração" na tela (termos técnicos); "usuários" (o termo da tela é "contas"); "pendente" solto (confunde com "Células com relatório pendente"); "Clique aqui" e "Ver mais".

### Acessibilidade
- Estrutura: `section` com `aria-labelledby` do `h2`; o título do card **não** é título (P110); o card é texto comum, sem papel interativo, sem `tabindex` e fora do Tab. Quem navega por títulos acha "Primeiro acesso" entre "Esta semana" e "Geral".
- A leitura é a frase da tabela de Textos, em ordem de DOM: o número vem logo depois do título, e o apoio e a porcentagem depois. A barra e o ícone são `aria-hidden`.
- Sem depender de cor: tom neutro; o progresso está também em texto; nenhum estado muda só de cor.
- Contraste de 4,5:1 nos textos e de 3:1 na barra contra o trilho, nos dois temas. Os textos usam `text-foreground` e `text-muted-foreground` sobre `bg-card` (o `--muted-foreground` sobre `bg-card` passa; o problema conhecido é só sobre `--muted`); o preenchimento `bg-primary` no tema escuro tem o contraste conhecido do `--primary` (Problemas conhecidos), mas é só reforço visual do texto.
- Zoom de 200%, 320 px e fonte grande: o card cai para a largura toda, os textos quebram linha, nada rola na horizontal.
- `motion-reduce`: sem animação na barra nem na entrada do card (herda a regra da página).

### Critérios de UX
Numeração própria deste spec. "Rita" tem `view_all_church`; "Pedro" só `view_own_ministry`.

| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | Rita, com 208 pendentes de 1.240: entre os `h2` "Esta semana…" e "Geral" há o `h2` "Primeiro acesso", com um card que diz "Contas sem primeiro acesso", "208", "de 1.240 contas com a senha do sistema antigo" e "83% já fizeram o primeiro acesso". Com 1 pendente de 1: "de 1 conta com a senha do sistema antigo". | teste de componente + E2E (massa) |
| UX-02 | O card não é `a`, `button` nem tem `tabindex`: sem `ChevronRight`, sem hover, sem `cursor-pointer`. Tocar ou dar Enter nele não navega nem muda a URL. Pelo Tab, o foco passa direto do último card de "Esta semana" ao primeiro de "Geral". Não há nome, lista nem link de pessoa na seção. | teste de componente + E2E |
| UX-03 | Pedro (e qualquer pessoa sem `view_all_church`): o DOM não tem "Primeiro acesso" nem "Contas sem primeiro acesso", e a rede não mostra consulta ao número. Com 0 pendentes (Rita, antes da carga ou depois do último primeiro acesso), a seção também não está no DOM, sem texto de vazio. | teste de componente + E2E (rede) |
| UX-04 | Arredondamento: 1.032 de 1.240 mostra "83%"; 1.239 de 1.240 mostra "99%" (nunca "100%"); 5 de 1.240 mostra "Menos de 1%"; 0 de 1.240 mostra "0%". A barra tem no mínimo 4 px quando há quem já entrou e é `aria-hidden`. | teste de unidade (regra pura) + componente |
| UX-05 | Tom neutro: o card usa `bg-card border`, ícone e título em `text-muted-foreground`, número em `text-foreground`; não tem `border-l-4`, `bg-warning`, `bg-success` nem `destructive`. O código não tem cor em hex nem cor solta do Tailwind. | teste de componente + inspeção |
| UX-06 | Primeira carga com consultas atrasadas: não há `Skeleton` nem "Carregando…" desta seção, e a seção aparece junto com os cards de "Geral", sem entrar antes de qualquer item já à vista. Depois de excluir uma conta com credencial pendente com o Dashboard aberto (e de restaurá-la), o número antigo fica com `opacity-60` e `aria-busy` até a resposta, e depois mostra N−1 e T−1 (e N e T de volta). | teste de componente + E2E |
| UX-07 | Com a consulta falhando: a seção mostra o `h2`, o texto de erro, "Tentar de novo" (44 px de altura no celular) e nenhum número; sem `role="alert"` na primeira carga e com ele depois de "Tentar de novo" falhar. Um toque refaz só essa consulta. Nenhum texto técnico. | teste de componente (rede simulada) |
| UX-08 | Em 360×800, o card ocupa a largura da coluna; em 1280×800, `max-w-xl` alinhado à esquerda. Em 320×640, com zoom de 200% e fonte do sistema a 130%, nada é cortado nem rola na horizontal; "20.000" e "1.240" cabem. Em 360×800 o card de pendentes de "Esta semana" continua visível sem rolar (UX-03 do E2.14). | teste E2E (viewport) + inspeção |
| UX-09 | O leitor de tela lê a seção como "Primeiro acesso" (título) e o card como "Contas sem primeiro acesso: 208, de 1.240 contas com a senha do sistema antigo. 83% já fizeram o primeiro acesso."; o ícone e a barra não são lidos. Axe sem violações, nos dois temas. | inspeção (leitor de tela, axe) |
| UX-10 | Com `prefers-reduced-motion: reduce`, o card não tem transição nem animação. As UX-01 a UX-18 do E2.14 continuam passando para Rita (a seção nova não quebra a ordem nem a grade). | teste E2E (emulação) + testes do E2.14 |

### Pendências para o `product-owner`
- **PO-UX-1. Posição do card.** Escolhi entre "Esta semana" e "Geral" (acima da dobra continua o card de pendentes do E2.14). Se o plantão preferir o card no topo do Dashboard durante a virada, a troca é só de ordem, mas empurra "Esta semana" para baixo em 360 px. Confirmar.
- **PO-UX-2. Termo "contas".** O card diz "contas" (e não "membros" nem "usuários"), porque o número conta credenciais (RN-14 b). Confirmar o termo, já que o glossário só define Membro.
- **PO-UX-3. Arredondamento.** Para baixo, nunca "100%" com alguém pendente, e "Menos de 1%" quando for o caso (UX-04). Confirmar. A alternativa seria mostrar a fração "208 de 1.240" sem porcentagem, mas a RN-14 b pede a porcentagem.
- **PO-UX-4. Fim silencioso.** Pela RN-14 f, quando o último pendente sai o card some sem aviso. Quem acompanha o plantão não vê "chegamos a todos". Se a liderança quiser um fechamento, é regra nova (mensagem por um tempo), e não está especificada. Sem resposta, vale a RN-14 f.

### Perguntas para o `architect`
- Contrato: o card precisa só de `pending` e `total` (duas contagens, sem nomes, sem hash), atrás do portão e de `view_all_church`; a reposta sem permissão deve ser indistinguível de "sem pendentes" para o card (a tela não faz a consulta sem a permissão, mas o banco recusa mesmo assim).
- O número entra na mesma atualização do Dashboard depois de gravar (P44): excluir ou restaurar membro (`refreshAfterMemberWrite`) e a redefinição de senha precisam recarregá-lo.
- A seção depende da casca do E2.14 (seções, P112, P114): se o E3.02 sair antes dela, o card entra no Dashboard atual como um `Card` solto abaixo de "Esta semana", e passa para a casca nova no E2.14.

## Solução técnica
_Seção do `architect`._ Código conferido na `origin/main` do `mci-connect` (423ca91): `sign_in_attempt` e o cofre em `20261126100200_e203_03_vault`, as RPCs de senha em `e203_04_rpcs`, a `sign-in` em `supabase/functions/sign-in`.

### Revisão das regras
Nenhuma RN bloqueia. A RN-05 acima de 72 bytes é viável sem aceitar o começo da senha (DT-04). Pontos definidos aqui (revisar no PR):
- **DA-1. Texto que o legado não calculava** (RN-02): senha ou identificação com *surrogate* isolado ou com U+0000 não chega ao banco (o Postgres não guarda nenhum dos dois; hoje vira 500). A `sign-in` responde 401 `invalid_credentials` depois do piso de 700 ms, **sem contar e sem Auditoria**: a tentativa nunca confere, então não ajuda a adivinhar.
- **DA-2. Senha legada acima de 72 bytes** (RN-05): depois da primeira entrada, a credencial continua sendo a senha da conta (marcada como usada) até a troca ou a redefinição. Para o card, a pessoa já fez o primeiro acesso.
- **DA-3. Sessão que falha depois da gravação** (RN-04): a senha é gravada e a credencial some no *commit* da `sign_in_attempt`; se a emissão da sessão falhar em seguida (500, raro), a pessoa tenta de novo com a mesma senha e entra pelo cofre. Nesse caso o "Login realizado" sai sem "Senha do sistema antigo".
- **DA-4.** O "Login realizado" leva "Senha do sistema antigo" sempre que a credencial conferiu, inclusive nas entradas seguintes do caso da DA-2.

### Visão geral
```
sign-in (Edge) ─ DA-1 ─▶ sign_in_attempt (uma transação)
  busca (E1.04) → conta disponível? → credencial pendente?
     sim: trava o cofre, relê a credencial → bcrypt(md5(senha)) contra ela
          ok ≤ 72 bytes: write_password (apaga a credencial) + política → legacy_weak
          ok > 72 bytes: credencial fica (used_at) + legacy_weak
     não: bcrypt(senha) contra o cofre; sem hash no cofre → no_password (bcrypt fictício)
  → { result: ok, …, credential: 'legacy' | 'account' }
sign-in → sessão → sign_in_record_login(_credential) → "Login realizado"
```

### Modelo de dados e migrations
| # | Arquivo | Conteúdo |
|---|---|---|
| 1 | `<ts>_e3_01_legacy_credentials.sql` | guarda de pré-requisito (cofre do E2.03); tabela; `add_legacy_credential`; `discard_legacy_credential` recriada; `legacy_credential_problems` |
| 2 | `<ts>_e3_02_sign_in_legacy.sql` | `sign_in_attempt` recriada; `sign_in_record_login` com `_credential`; `DROP private.sign_in_check_legacy`; `dashboard_first_access` |

`<ts>` maior que o da última migration da `main` no merge (regra das pistas).

```sql
CREATE TABLE private.legacy_credentials (
  member_id    uuid PRIMARY KEY REFERENCES public.members (id),   -- NO ACTION (DEL-)
  legacy_hash  text CHECK (legacy_hash ~ '^\$2a\$10\$[./A-Za-z0-9]{53}$'),  -- bcrypt(md5), custo 10
  loaded_at    timestamptz NOT NULL DEFAULT now(),
  used_at      timestamptz,          -- primeira entrada com ela (DA-2)
  discarded_at timestamptz,          -- senha gravada no novo (RN-03)
  CONSTRAINT legacy_credentials_discard CHECK ((legacy_hash IS NULL) = (discarded_at IS NOT NULL))
);  -- RLS ligado, sem políticas; REVOKE ALL de PUBLIC, anon, authenticated, service_role
```
- **DT-01. A linha fica; o hash some.** A RN-03 apaga a credencial anulando `legacy_hash` (com `discarded_at`); a linha guarda quem recebeu credencial na carga, que é o "total" da RN-14 b. Pendente = `legacy_hash IS NOT NULL AND used_at IS NULL`. Nenhuma coluna tem MD5 ou senha (RN-01).
- **DT-02. Custo 10 fixo no `CHECK`:** o tempo da conferência é o mesmo do cofre e do bcrypt fictício (DT-07 do E1.04).

### Funções
| Função | Contrato |
|---|---|
| `private.add_legacy_credential(_member_id uuid, _legacy_md5 text) RETURNS text` | A carga do E4.08 (como `postgres`, uma chamada por membro, pode rodar em lotes paralelos). Devolve `created`, `updated` (pendente regravada), `kept_used` (usada ou descartada: nunca recria), `has_password` (hash no cofre, RN-03, RN-16 a), `unusable_md5` (fora de `^[0-9a-f]{32}$` ou o MD5 vazio, RN-01 c) ou `not_eligible` (membro inexistente, excluído ou sem `auth_user_id`, RN-01 a, b). Cria a linha do cofre (`password_hash` nulo, sem marca) se faltar e a trava antes de olhar o hash (DT-05). |
| `private.discard_legacy_credential(_member_id)` | Recriada: anula o hash pendente (`discarded_at = now()`). Já é chamada pela `write_password`, então redefinição, troca, senha inicial e primeira entrada apagam a credencial sem mudança nelas (RN-03). |
| `private.legacy_credential_problems()` | Para a reconciliação (5.6), precisa voltar vazia: `both_passwords` (credencial pendente e hash no cofre), `no_account` (credencial pendente de membro sem conta), `kept_without_mark` (usada, com hash, sem a marca `legacy_weak`). |
| `public.dashboard_first_access() RETURNS TABLE (pending int, total int)` | DT-09. |

### Conferência na `sign_in_attempt` (RN-02 a RN-08, RN-11, RN-12)
Recriada a partir do corpo de `e203_03`; limites, travas, `lock_timeout`, teto de 5 s e a ordem dos motivos do E1.04 não mudam. Muda o passo 6:
1. Conta: as condições do Auth (como hoje, sem o hash) dão `account_ok`; falhou, `account_unavailable`.
2. Credencial pendente (leitura sem trava). Se há: `INSERT … ON CONFLICT DO NOTHING` no cofre, `SELECT … FOR UPDATE` da linha do cofre, e **relê** a credencial. Ainda pendente (ou usada com hash, DA-2): `_hash` = a credencial, `_input` = `md5(_password)`, `credential = 'legacy'`. Senão, segue o cofre.
3. Cofre: `_hash` = `password_hash`, `_input` = `_password`; com hash nulo, `no_password` (RN-08) e o hash fictício.
4. **Um bcrypt:** `crypt(_input, coalesce(_hash, c_dummy))`. No cofre, continua a DA-5 do E1.04 (acima de 72 bytes não confere); na credencial, não há limite (o MD5 tem 32 bytes).
5. Sucesso com a credencial: até 72 bytes, `write_password(_auth, _member, _password, NULL)` (grava como digitada e apaga a credencial) e `used_at`; acima, só `used_at` (DA-2). Nos dois, `password_policy_violation` (a a g) põe `legacy_weak` por `set_must_change`, com "Troca de senha exigida" só quando a marca é nova (RN-05, RN-13 b), como no `weak_password` de hoje. Na entrada seguinte de quem não trocou, a marca já existe e não há novo registro.
6. Falha: `wrong_password` com `metadata.credential = 'legacy'` quando a credencial foi conferida (RN-13 c); `no_password` → "Sem senha definida" (RN-13 d). Contagem, bloqueio e Auditoria das falhas como hoje (RN-06).
7. Retorno `ok`: acrescenta `credential` (`'account'` ou `'legacy'`); `password_action` continua `null` (DT-07).

- **DT-03. MD5 no banco:** `md5(text)` do Postgres calcula sobre os bytes UTF-8 (banco em UTF8), em hexadecimal minúsculo, sem normalizar: é o pacote `md5` 2.3.0 para todo texto que o Postgres aceita. A tabela de casos prova (tarefa 5).
- **DT-04. Acima de 72 bytes** (RN-05): o cofre não guarda (bcrypt corta em 72), então a credencial, que confere o MD5 da senha inteira, continua sendo a senha até a troca (DA-2). O começo da senha tem outro MD5 e falha; depois da troca, a `write_password` apaga a credencial e as 80 letras caem na DA-5. A troca obrigatória funciona com o cofre sem hash (a `change_own_password` só compara com a senha atual quando há hash; e uma nova ≤ 72 bytes nunca é igual a uma de 80).
- **DT-05. Concorrência (RN-12, RN-03).** Ordem de travas: limites → membro (E2.01) → `auth.users` → **cofre → credencial**, a mesma da `write_password` (cofre, depois `discard`), da `change_own_password` e da `set_initial_password`. Duas entradas simultâneas: a segunda espera o cofre, relê a credencial já anulada, confere pelo cofre e entra como login comum (um só primeiro acesso, um só bcrypt em cada). Entrada × redefinição: vale a última a fazer *commit* (RN-04 do E2.03). A carga trava o cofre antes de conferir o hash, então não cria credencial para quem acabou de gravar senha.
- **DT-06. `no_password`** substitui o `account_unavailable` da DA-9 do E1.04 para a conta disponível sem senha. O tempo é o do bcrypt fictício.
- **DT-07. Contrato compatível na publicação:** o "Deploy: banco" aplica as migrations antes de publicar a `sign-in`. O `ok` ganha só um campo novo (a `sign-in` antiga ignora), `password_action` fica `null` e a `sign_in_record_login(_member_id, _auth_user_id, _identifier_type, _identifier_masked, _credential text DEFAULT 'account')` troca a de 4 parâmetros (a chamada antiga resolve pelo padrão). `_credential` fora de `account`/`legacy` dá 22023; `legacy` grava `metadata.credential = 'legacy'`.
- **DT-08.** `private.sign_in_check_legacy` sai (o ponto vazio do E1.04 vira o passo 2).

### Card "Primeiro acesso" (RN-14)
- **DT-09.** `dashboard_first_access()`: `SECURITY DEFINER`, `STABLE`, `SET search_path = public`, EXECUTE só para `authenticated`. Sem `viewer_has('view_all_church')` (que passa pelo portão), 42501, como o `_dashboard_assert_access`. Conta `private.legacy_credentials` com `members.deleted_at IS NULL` (RN-14 d): `total` = todas as linhas, `pending` = as pendentes. Não lê hash, nomes nem ids (RN-14 c). O `e203_06_gate` a cobre pelo catálogo.
- **Respostas à UX:** (1) sem permissão o banco dá 42501, e a tela nem consulta; se a permissão cair no meio da sessão, o 42501 relê o acesso (E2.02) e a seção some. (2) A chave `["dashboard", "first_access"]` entra no `refreshAfterMemberWrite` e no sucesso da redefinição de senha (P44). (3) O card segue a ordem da UX: com o E2.14 já no ar, entra na casca dele; senão, no Dashboard atual. Os dois passos não rodam em paralelo (mesma tela).
- A regra de exibição (RN-14 f, `pending > 0`) e o arredondamento (UX-04) ficam em `src/lib/dashboard/first-access.ts`, sem React.

### Edge Function `sign-in`
- `lib/contract.ts`: `isWellFormedText` (sem *surrogate* isolado e sem U+0000) para a DA-1; `AttemptResult.ok` aceita `credential` (`'account' | 'legacy'`, ausente = `'account'`).
- `index.ts`: a DA-1 antes da RPC (log `invalid_credentials`, código `ill_formed`); `_credential` na `sign_in_record_login`. A resposta à tela não muda.

### Onde cada regra é imposta
| RN | Banco | Edge / tela |
|---|---|---|
| RN-01 | `add_legacy_credential`, `CHECK` do formato | — |
| RN-02 | `md5(_password)` no passo 4 | DA-1 |
| RN-03, RN-07, RN-11 | `write_password` → `discard_legacy_credential`; `add_legacy_credential` (`has_password`, `kept_used`); sem job de limpeza | — |
| RN-04, RN-05, RN-12 | `sign_in_attempt` passos 2 a 5, trava do cofre | troca obrigatória do E2.03 |
| RN-06, RN-08 | passo 6, limites do E1.04 | mensagem única |
| RN-09, RN-10 | busca do E1.04 (`member_deleted`); `delete_member`/`restore_member` não tocam a credencial | — |
| RN-13 | `_log_event` na RPC e `sign_in_record_login` | Auditoria (tarefa 8) |
| RN-14 | `dashboard_first_access` | card (tarefa 9) |
| RN-15 a RN-18 | E4.08 (abaixo) | — |

### Para o E4.08 (fora deste passo)
- Criar as contas (6.2), depois `add_legacy_credential` com o `Members.Password` de cada um, e listar os resultados que não são `created`/`updated` (`unusable_md5` = a lista "sem senha" da 5.4). Medir no ensaio 1: um bcrypt de custo 10 por membro (tarefa 6).
- Limpeza dos ensaios (RN-17): apagar as credenciais e as linhas do cofre **só das contas criadas pela carga** (`app_metadata.legacy_member_id`); as contas que já existiam ficam (RN-16 a). RN-16 b (ligar o cadastro do legado à conta que já existe) e a conta criada na restauração de quem foi excluído no legado (RN-09) também são de lá.
- RN-18: funções depois do `private.rebuild_member_hierarchy()` (Líder para `g12_level = 1`, Administrador pela lista aprovada, Membro para os demais), com a reconciliação de pelo menos 2 Administradores não excluídos com conta. A 5.6 ganha: `legacy_credential_problems()` vazia e credenciais `created` = membros com senha utilizável e conta.

### Riscos
1. **Tempo da carga:** cerca de 70 a 100 ms por credencial (bcrypt custo 10). Com milhares de membros, rodar em lotes paralelos; medir no ensaio 1.
2. **Senha em parâmetro** (DT-19 do E1.04): o caminho legado faz até dois bcrypts (conferir e gravar), ainda longe do teto de 5 s, que continua.
3. **Encoding:** a DT-03 depende do banco em UTF8 (conferido na tarefa 1 e no pgTAP).
4. **DA-3:** primeiro acesso sem o registro "Senha do sistema antigo" quando a sessão falha depois do *commit*; a credencial já sumiu e a senha é a mesma.
5. **Vazamento da tabela:** `bcrypt(md5)` sem prazo (D6). Quebrar exige um bcrypt de custo 10 por palpite e conta; o MD5 dos backups do legado não serve como credencial, porque a `sign-in` recebe a senha.
6. **Mudança de motivo:** contas de produção sem hash no cofre passam de "Conta de acesso indisponível" a "Sem senha definida" (DT-06); a tarefa 1 conta quantas são.

### Implantação
- **PR 1 (banco: tarefas 1 a 7).** Merge → "Deploy: banco" (migrations e `sign-in`) → login de uma conta comum em produção (o caminho do cofre) e, como `postgres` só leitura, `SELECT count(*) FROM private.legacy_credentials` = 0. Sem promote (o front não muda). Nada muda para quem usa enquanto não houver credencial (antes do E4.08).
- **Conferências em produção** (tarefa 1, só leitura, com autorização do usuário): `SHOW server_encoding` = UTF8; quantas contas de membros não excluídos não têm hash no cofre; a `private.legacy_credentials` não existe.
- **Rollback:** migration nova que recria a `sign_in_attempt` de `e203_03` e a `sign_in_record_login` de 4 parâmetros, mais a `sign-in` anterior; a tabela fica (vazia até o E4.08). Depois da carga, um rollback deixa os membros do legado sem entrar (só `no_password`): exige decisão do usuário.
- **PR 2 (front: tarefas 8 a 10),** depois do PR 1 em produção: merge → promote. Sem banco.

## Tarefas
| # | Resp. | PR | Tarefa | RN | Pronto quando | Dep. |
|---|---|---|---|---|---|---|
| 1 | backend-developer | 1 | Conferências em produção da Implantação, só leitura e com autorização do usuário. | — | resultado (só contagens) anotado no relatório | — |
| 2 | backend-developer | 1 | Migration 1: tabela, `add_legacy_credential`, `discard_legacy_credential`, `legacy_credential_problems`, grants e RLS. | 01, 03, 07, 10 | pgTAP de estrutura e grants; `write_password` anula a credencial; carga refeita não recria (`has_password`, `kept_used`) | — |
| 3 | backend-developer | 1 | Migration 2: `sign_in_attempt` (passos 1 a 7), `sign_in_record_login` com `_credential`, `DROP sign_in_check_legacy`, `dashboard_first_access`; atualizar os pgTAP do E1.04 e do E2.03 que esperavam `account_unavailable` sem hash ou o ponto vazio; regenerar `types.ts`. | 02, 04 a 06, 08, 11 a 14 | pgTAP inteiro verde; teto de 5 s e um bcrypt por falha mantidos | 2 |
| 4 | backend-developer | 1 | `sign-in`: DA-1 e `credential` (`contract.ts`, `index.ts`) com Vitest do contrato (*surrogate*, U+0000, `credential` ausente, inválido e `legacy`). | 02, 13 | Vitest verde; logs sem senha | 3 |
| 5 | qa | 1 | E3.03, tabela de casos: `md5@2.3.0` exato em `devDependencies`; `supabase/tests/fixtures/generate-legacy-md5-cases.mjs` → `legacy-md5-cases.json` (ASCII, "ç" composto e decomposto, espaços nas pontas, maiúsculas, emoji, `123456`, 72 e 80 letras, 40 "ç" = 80 bytes, texto vazio, *surrogate* isolado como "não calculável") → pgTAP `e3_02_md5_cases` (`md5()` = esperado e entrada pela `sign_in_attempt` com a credencial carregada pela `add_legacy_credential`); `src/test/legacy-md5-cases-sync.test.ts` refaz os MD5 pelo pacote e confere o SQL gerado. | 01, 02, 05 | os três lugares iguais; o sync quebra se divergirem | 3 |
| 6 | qa | 1 | E3.03, critérios: pgTAP com a massa (Ana a Hugo; RN-18 fica para o E4.08); concorrência no molde do `e104_concurrency.sh` (20 entradas simultâneas de Ana com a senha certa: todas `ok`, uma `used_at`, um hash no cofre, um "Senha do sistema antigo"; entrada × redefinição; carga × redefinição, sem 40P01); volume (20 mil credenciais: `dashboard_first_access` < 50 ms; vazão da `add_legacy_credential` anotada para o E4.08); Playwright: Ana pelo celular com máscara, Bruno pelo CPF até a troca e o "Senha incorreta" de Hugo com 72 letras. | 02 a 13 | suíte inteira (PR com migration) verde | 3, 4 |
| 7 | architect | 1 | Conferência das migrations (RLS, *definer*, grants, ordem de travas). | — | aprovado | 6 |
| 8 | frontend-developer | 2 | Auditoria: `no_password` "Sem senha definida", `legacy_weak` "Senha fora das regras" e `metadata.credential = 'legacy'` como a linha "Senha do sistema antigo" em `src/lib/audit/auth-events.ts` (*type guard*) e no detalhe do evento. | 13 | Vitest dos rótulos e do *type guard* | PR 1 |
| 9 | frontend-developer | 2 | Card T-LG1 pela seção UX (UX-01 a UX-10): `src/lib/dashboard/first-access.ts` (visibilidade e arredondamento), `src/hooks/use-first-access.ts` (só com `view_all_church`), o componente no Dashboard; a chave no `refreshAfterMemberWrite` e na redefinição. | 14 | Vitest da regra pura; nenhuma consulta sem a permissão | PR 1, UX |
| 10 | qa + ux-designer | 2 | Vitest, tsc, build, lint; Playwright do card (UX-01 a UX-10) e da Auditoria, mais o smoke de login (último PR do passo: suíte inteira); revisão de UI do card (tela nova). | 13, 14 | verde; achados resolvidos | 8, 9 |
| 11 | architect | 2 | Revisão final do passo; `CLAUDE.md` (estado atual e armadilhas: a credencial e a ordem cofre → credencial) e Progresso E3.01 a E3.03 em `docs/migracao.md`. | — | APROVADO | 10 |

Paralelo: 4 junto com 3 depois da migration 2 pronta na stack; 5 começa com a 3; 8 e 9 no mesmo PR, em paralelo.
