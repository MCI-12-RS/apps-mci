# Escolas e Turmas: pesquisa e rascunho do PO (2026-11-22)

> Material de trabalho para o plano em [`escolas.md`](escolas.md). É o relatório do `product-owner` **antes** das decisões do usuário de 2026-11-22. Os ajustes que essas decisões exigem estão no passo 2 do plano. Quando o spec `docs/specs/escolas.md` estiver pronto, ele passa a ser a fonte, e este arquivo pode ser removido.

**Afiliação (P-20).** A Missão Carismática Internacional é a igreja do Pr. César Castellanos, em Bogotá. O Ap. Renê Terra Nova lidera outra rede, a M12 (Ministério Internacional da Restauração, em Manaus). "Universidade da Vida" e "Capacitação Destino" são nomes do material da Editora G12, de Castellanos; uma igreja da rede M12 pode usar outros nomes. Não há informação pública sobre a igreja local.

---

## 1. Pesquisa de domínio

### Onde cada escola entra na Escada do Sucesso

**Ganhar**
- Escolas e eventos: nenhuma escola.
- O que as fontes dizem: evangelismo, Oração 3x3, células e cultos (Comunidade Vitória).
- Consenso ou variação: consenso.

**Consolidar**
- Escolas e eventos: **Pré-Encontro → Encontro → Pós-Encontro**, reunidos na **Universidade da Vida**.
- O que as fontes dizem:
  - **Pré-Encontro:** 4 ensinamentos em 4 semanas, dados pelo "Coordenador e equipe de guias" (base oficial G12).
  - **Encontro:** retiro de cerca de 3 dias, em geral no fim de semana.
  - **Pós-Encontro:** 4 temas em 4 semanas (base oficial G12).
  - **Universidade da Vida:** curso de 9 semanas que "inicia quando a pessoa participa da primeira aula de Pré-encontro" e "termina quando a pessoa se batiza" (G12 Brasil).
- Consenso ou variação:
  - A UV de 9 semanas, ligada ao batismo, é consenso nas fontes oficiais.
  - A duração do Pós-Encontro **varia**: 4 semanas na base oficial, 3 meses ou 10 palestras em outras fontes.

**Discipular**
- Escolas e eventos: **Capacitação Destino (CD)**, mais o **Reencontro**.
- O que as fontes dizem:
  - A CD usa seis livros de Castellanos:
    1. Pastoreados em seu Amor
    2. O Poder de uma Visão
    3. A Estratégia do Ganhar
    4. Famílias com Propósito
    5. Liderança Eficaz
    6. O Espírito Santo em Mim
  - São 10 aulas por módulo, em geral organizadas em **3 níveis com 2 módulos cada** (MCI Sabana Norte, MCI Zipaquirá, Church Vilas).
  - Segundo a base oficial G12, a etapa **começa na inscrição na CD**. Ela **termina** quando a pessoa conclui o nível 3, participa de um Reencontro e abre uma célula.
  - O objetivo da CD é "formar líderes que abram uma célula".
- Consenso ou variação:
  - A estrutura de 6 livros e 10 aulas é consenso.
  - A duração **varia**: 10 semanas, 12 semanas ou 3 meses por nível, e de 9 meses a 1 ano no total.
  - Uma igreja organiza a CD em semestres (ago–dez e jan–jun).

**Enviar**
- Escolas e eventos: nenhuma escola.
- O que as fontes dizem: liderar uma célula aberta e formar os 12.
- Consenso ou variação: consenso.

### Pré-requisitos (variam por igreja)
- **Para entrar na CD:**
  - ter feito a UV e ser batizado (MCI Constitución);
  - ou ter feito a UV, ter ido ao Encontro e participar de célula (Church Vilas).
- **Para o nível 2 da CD:** ter concluído o nível 1 e participar de célula (Church Vilas).
- **Para a Escola de Líderes:** já ter passado pelo Encontro (IAR).

### Escola de Líderes × Capacitação Destino
- Uma igreja descreve a CD como "o novo programa de formação da Escola de Líderes" (Agua de la Roca).
- Várias igrejas brasileiras ainda chamam de "Escola de Líderes" um formato de 3 níveis com 3 meses cada.
- Provavelmente é a mesma escola com nomes diferentes. A confirmar.

### Reencontro
- É um retiro.
- O momento varia: durante o 2º nível (Comunidade Vitória) ou antes de concluir a etapa Discipular (base G12).
- Uma fonte crítica ao movimento diz que dura de 3 a 4 dias.

### Critérios de aprovação (há poucas fontes)
- **Única regra concreta encontrada** (Church Vilas, CD 2022):
  - o aluno precisa participar de pelo menos 7 aulas para seguir ao próximo módulo;
  - cada aula vale 2 presenças, então o mínimo é 14;
  - quem não alcança o mínimo "reinicia na próxima turma", salvo faltas justificadas.
- **Refazer:** a MCI Durango cobra a inscrição de quem refaz a escola ("Recursamiento"), então refazer existe.
- **Provas:** nenhuma fonte fala em prova.
- **Formatura e certificado:** nenhuma fonte oficial menciona. Uma fonte crítica diz que, para se formar na Escola de Líderes, é preciso ter aberto célula até o 3º trimestre.

### Quem dá as aulas
- Na CD, o professor é o "mestre": a Editora G12 vende o "Kit Mestre".
- Outras igrejas falam em "professores capacitados".
- No Pré-Encontro, quem conduz são o coordenador e os guias.

### Escola de Mestres e Escola de Timóteos
Não há fonte para nenhuma das duas, nem na MCI nem na G12. Ficaram fora do catálogo e viraram pergunta.

### Outro software para igrejas G12 (referência de produto, não de doutrina)
Um software público para igrejas G12 adota três regras:
- a reposição de aula conta como presença;
- a matrícula nunca é automática;
- quem pode se matricular na CD vem da UV concluída ou de dados importados de um sistema anterior.

Isso confirma que reposição e carga histórica são necessidades reais.

---

## 2. Catálogo inicial sugerido

Tudo aqui é sugestão do PO, para a liderança confirmar. O catálogo é **dado**: o gestor cadastra as escolas, então o catálogo não muda o schema. Com a decisão de 2026-11-22 (aprovação só manual), a coluna "Aprovação sugerida" vira só orientação para o gestor.

| # | Escola | Etapa | Aulas | Pré-requisito sugerido | Aprovação sugerida |
|---|---|---|---|---|---|
| 1a | **Universidade da Vida** (opção A: uma escola só) | Consolidar | 9 semanas, contando o Encontro | nenhum | presença no Encontro e frequência mínima nas demais aulas |
| 1b | Opção B: **Pré-Encontro**, **Encontro** e **Pós-Encontro** em separado | Consolidar | 4 / 1 (participou) / 4 | nenhum / Pré-Encontro / Encontro | Pré e Pós: frequência mínima. Encontro: ter participado. |
| 2 | **Capacitação Destino – Nível 1** (Pastoreados em seu Amor + O Poder de uma Visão) | Discipular | 20 lições, ou 10 reuniões de 2 lições (P-02) | UV ou Encontro; batismo e participação em célula a confirmar | frequência ≥ 70% (7 de 10, como na Church Vilas) |
| 3 | **Capacitação Destino – Nível 2** (A Estratégia do Ganhar + Famílias com Propósito) | Discipular | idem | CD Nível 1; participação em célula a confirmar | idem |
| 4 | **Reencontro** | Discipular | 1 (participou) | CD Nível 1 ou 2 (a confirmar) | ter participado |
| 5 | **Capacitação Destino – Nível 3** (Liderança Eficaz + O Espírito Santo em Mim) | Discipular | idem | CD Nível 2 | frequência ≥ 70%; ter célula aberta a confirmar |

Ficaram de fora: Escola de Líderes (provavelmente é a própria CD), Escola de Mestres e Escola de Timóteos. Só entram se a igreja confirmar que existem.

---

## 3. Rascunho da seção Negócio

````markdown
# Escolas e turmas

> Status: rascunho
> Slug: `escolas` · Paridade com o legado: não (feature nova; o legado não tem escolas)

## Negócio
_Seção do `product-owner`._

### Contexto e objetivo
A Escada do Sucesso (Ganhar, Consolidar, Discipular, Enviar) passa por escolas:
- na Consolidação: Pré-Encontro, Encontro e Pós-Encontro, reunidos na Universidade da Vida;
- no Discipulado: a Capacitação Destino e o Reencontro.

Hoje a igreja não registra no sistema quem fez cada escola. Por isso os líderes não sabem em que degrau cada discípulo está.

Objetivo:
- cadastrar as escolas e suas turmas;
- registrar a chamada de cada aula;
- definir quem foi aprovado e quem foi reprovado;
- mostrar no cadastro de cada membro as escolas que ele concluiu (certificações).

Requisitos dados pelo usuário em 2026-11-22, citados como U1 a U6 nas regras:
- U1: cada escola, ao ser concluída por um membro, confere a ele uma certificação (badge) no cadastro. Um membro tem várias escolas concluídas, e uma escola tem vários concluintes.
- U2: cada membro pode estar em nenhuma ou em várias turmas; cada turma pertence a uma escola.
- U3: a turma tem um período de aulas (início e fim).
- U4: cada escola tem X aulas. A turma tem a relação dos alunos, e as X aulas registram a presença de cada aluno.
- U5: quem tem permissão de gerenciar as escolas define a presença de cada aluno na turma.
- U6: o membro pode ser reprovado na turma e, nesse caso, não recebe a certificação.

### Termos
- **Escola**: um curso da Escada (ex.: Pré-Encontro, Capacitação Destino – Nível 1), com um número fixo de aulas.
- **Turma**: uma edição da escola, com período, alunos e chamada.
- **Aula**: cada encontro da turma em que se faz a chamada.
- **Aluno**: membro matriculado numa turma.
- **Chamada**: o registro de presença dos alunos numa aula.
- **Situação do aluno**: Em andamento, Aprovado ou Reprovado.
- **Certificação**: o registro de que o membro concluiu a escola. Na tela, aparece como "Escolas concluídas".
- **Professor**: quem dá as aulas da turma. O termo está a confirmar: Professor, Mestre ou Facilitador (P-09).

### Personas e permissões
| Persona | Quem é | Permissões |
|---|---|---|
| G Gestor de escolas | coordenação das escolas | "Gerenciar Escolas" (nova) |
| A Administrador | função `is_system` | todas |
| P Professor | membro designado na turma (a confirmar, P-09) | nenhuma especial; ver ESC-16 |
| L Líder | acompanha os discípulos | `view_own_ministry` |
| M Membro (aluno) | membro matriculado | `edit_own_data` |
| S Sem permissão | qualquer usuário sem "Gerenciar Escolas" | — |

### Histórias
- Como gestor de escolas, quero cadastrar as escolas com suas aulas e pré-requisitos, para que todas as turmas sigam o mesmo programa.
- Como gestor de escolas, quero abrir uma turma com período e alunos, para organizar cada edição da escola.
- Como gestor de escolas (ou professor), quero lançar a chamada de cada aula, para saber quem atingiu a frequência.
- Como gestor de escolas, quero encerrar a turma e ver quem foi aprovado e quem foi reprovado, para conceder as certificações.
- Como membro, quero ver no meu cadastro as escolas que concluí e as que estou cursando.
- Como líder, quero saber quais escolas meus discípulos já concluíram, para acompanhar cada um na Escada do Sucesso.
- Como gestor de escolas, quero registrar quem concluiu uma escola antes do sistema, para que essas pessoas não precisem refazê-la.

### Regras de negócio
| ID | Regra | Origem |
|---|---|---|
| ESC-01 | **Escola.** Tem nome (obrigatório) e quantidade de aulas (número inteiro, no mínimo 1). | definida pelo usuário (2026-11-22, U4) |
| ESC-02 | **Nome único.** Duas escolas não excluídas não podem ter o mesmo nome. A comparação ignora maiúsculas, acentos e espaços nas pontas. | a confirmar (proposta do PO) |
| ESC-03 | **Aulas da escola.** As aulas são numeradas de 1 a X, na ordem em que acontecem, e cada uma pode ter um título. | a confirmar (P-02) |
| ESC-04 | **Pré-requisitos.** Uma escola pode exigir que o aluno já tenha a certificação de outras escolas. Sem todas elas, o membro não é matriculado. Os pré-requisitos não podem formar ciclo, nem direto nem indireto. | a confirmar (P-06) |
| ESC-05 | **Escola inativa.** Uma escola pode ser desativada. Ela não recebe turmas novas, mas as turmas existentes continuam e as certificações seguem valendo. | a confirmar (proposta do PO) |
| ESC-06 | **Turma.** Toda turma pertence a exatamente uma escola, informada no cadastro. | definida pelo usuário (2026-11-22, U2) |
| ESC-07 | **Período.** A turma tem data de início e data de fim, as duas obrigatórias. A data de fim não pode ser anterior à de início. | definida pelo usuário (2026-11-22, U3) |
| ESC-08 | **Aulas da turma.** Ao ser criada, a turma recebe as aulas que a escola tem naquele momento; mudanças posteriores na escola não afetam turmas existentes. Cada aula da turma pode ter uma data, dentro do período. A escola de uma turma não pode ser trocada depois que ela tem alunos. | a confirmar (P-02) |
| ESC-09 | **Professor.** A turma tem um ou mais professores, escolhidos entre os membros. | a confirmar (P-09) |
| ESC-10 | **Turma encerrada.** O gestor encerra a turma ao fim das aulas. A turma encerrada não aceita matrícula, chamada nem mudança de situação até ser reaberta por um gestor. | a confirmar (P-11) |
| ESC-11 | **Alunos.** Os alunos são membros cadastrados e não excluídos. Um membro pode estar em nenhuma, uma ou várias turmas, mas aparece no máximo uma vez em cada turma. Fora as regras ESC-04, ESC-12 e ESC-13, nada impede a matrícula: ser pastor, não ter líder ou ser casado não impede. | definida pelo usuário (2026-11-22, U2); excluídos: D1 / DEL-02 |
| ESC-12 | **Membro inativo.** Um membro inativo não pode ser matriculado. Se ele ficar inativo durante a turma, a matrícula, as presenças e a situação dele continuam. | a confirmar (P-13) |
| ESC-13 | **Uma matrícula por escola.** O membro não pode ter duas matrículas "Em andamento" na mesma escola, nem ser matriculado numa escola que já concluiu. | a confirmar (P-05) |
| ESC-14 | **Chamada.** Em cada aula da turma, cada aluno tem no máximo um registro de presença: "Presente" ou "Ausente". Sem registro, a aula aparece como "Não lançada" para aquele aluno. Lançar a chamada de novo altera o registro existente, sem criar outro. | definida pelo usuário (2026-11-22, U4) |
| ESC-15 | **Quem lança a chamada.** Só quem tem a permissão "Gerenciar Escolas" lança ou altera presença. O aluno não marca a própria presença. | definida pelo usuário (2026-11-22, U5) |
| ESC-16 | **Chamada pelo professor.** O professor da turma também lança a chamada dela, mesmo sem "Gerenciar Escolas". | a confirmar (P-07) |
| ESC-17 | **Aula futura.** Não se lança a chamada de uma aula cuja data ainda não chegou. "Hoje" é contado no horário de Brasília. | a confirmar (P-02) |
| ESC-18 | **Falta justificada e reposição.** Uma ausência pode ter justificativa (texto) e continua contando como falta. A reposição registrada conta como presença. | a confirmar (P-04) |
| ESC-19 | **Situação do aluno.** Ao ser matriculado, o aluno fica "Em andamento". Depois, passa a "Aprovado" ou "Reprovado". | definida pelo usuário (2026-11-22, U6); `CLAUDE.md` (Features futuras) |
| ESC-20 | **Critério de aprovação.** Cada escola define uma frequência mínima, em % das aulas da turma. Ao encerrar a turma, o sistema propõe "Aprovado" para quem atingiu a frequência e "Reprovado" para quem não atingiu. O gestor confirma e pode mudar a situação de um aluno, informando o motivo. | a confirmar (P-03) |
| ESC-21 | **Reprovado não recebe certificação.** | definida pelo usuário (2026-11-22, U6) |
| ESC-22 | **Refazer a escola.** Quem foi reprovado pode ser matriculado em outra turma da mesma escola. A reprovação anterior continua no histórico. | a confirmar (P-05) |
| ESC-23 | **Certificação.** Quando o aluno passa a "Aprovado", recebe a certificação da escola, ligada à turma de origem e com a data de conclusão. A situação e a certificação são gravadas juntas (tudo ou nada). | definida pelo usuário (2026-11-22, U1); a data de conclusão depende da P-03 |
| ESC-24 | **Uma certificação por escola.** O membro tem no máximo uma certificação não excluída de cada escola. | definida pelo usuário (2026-11-22, U1) |
| ESC-25 | **Certificações no cadastro.** O cadastro do membro mostra "Escolas concluídas", com a data de conclusão de cada uma. | definida pelo usuário (2026-11-22, U1) |
| ESC-26 | **Desfazer a aprovação.** Se o gestor muda a situação de "Aprovado" para outra, a certificação gerada por aquela turma é excluída (exclusão lógica). | a confirmar (P-15) |
| ESC-27 | **Certificação concedida manualmente.** O gestor pode registrar a certificação de quem concluiu a escola antes do sistema, informando a data de conclusão (que não pode ser futura) e uma observação. Ela fica marcada como "Concedida manualmente", sem turma, e vale como pré-requisito. | a confirmar (P-10) |
| ESC-28 | **Permissão "Gerenciar Escolas".** É uma permissão nova, configurável na tela de Funções. Sem ela, ninguém cria, edita ou exclui escolas, turmas, matrículas, chamadas, situações ou certificações, nem pela API. A função Administrador (`is_system`) recebe a permissão no banco. | definida pelo usuário (2026-11-22, U5); a regra do Administrador segue a RN-14 do E1.08 (a confirmar) |
| ESC-29 | **Escopo da gestão.** Quem gerencia escolas cuida das turmas da igreja toda e pode matricular qualquer membro ativo. No seletor de alunos, membros fora do escopo do gestor aparecem só pelo nome. | a confirmar (P-07) |
| ESC-30 | **Quem vê.** (a) O membro vê as próprias turmas, presenças, situações e certificações. (b) Quem vê o cadastro de um membro (o mesmo escopo de Membros) vê as certificações dele. (c) A turma completa e a chamada ficam visíveis só para os gestores e para os professores da turma. | a confirmar (P-08) |
| ESC-31 | **Exclusão lógica.** Escolas, turmas, matrículas e certificações são excluídas logicamente. Registros excluídos não aparecem em telas, seletores nem contagens, e não contam como pré-requisito cumprido. | D1 (2026-11-14), DEL-01, DEL-02 |
| ESC-32 | **Excluir com dependentes.** Uma escola com turma não excluída não pode ser excluída. Uma turma com aluno aprovado também não. A mensagem diz o que falta resolver. | a confirmar (P-16) |
| ESC-33 | **Membro excluído.** Quando um membro é excluído, as matrículas e as certificações dele deixam de aparecer e de contar. Se ele for reativado, tudo volta como estava. | DEL-02, DEL-09 |
| ESC-34 | **Auditoria.** A criação, a alteração e a exclusão de escola, turma, matrícula, presença, situação e certificação ficam na Auditoria, com o autor e o horário. | padrão do projeto (`events`, MEM-12) |
| ESC-35 | **Casal.** Matrícula, chamada, situação e certificação são individuais, mesmo quando marido e esposa estão na mesma turma. | a confirmar (P-14) |

As regras "a confirmar" não seguem para implementação. Os critérios de aceite delas usam o valor proposto, marcado como "(valor proposto)".

### Critérios de aceite
- **ESC-01**
  - Dado um usuário com "Gerenciar Escolas"
  - Quando ele cadastra a escola "Pré-Encontro" com 4 aulas
  - Então a escola aparece na lista com 4 aulas.
  - Dado o mesmo usuário
  - Quando ele tenta salvar uma escola sem nome, ou com 0 aulas, mesmo chamando a API direto
  - Então nada é gravado, e a mensagem é "Informe o nome da escola." ou "A escola precisa ter pelo menos 1 aula.".
- **ESC-02** (valor proposto)
  - Dada a escola "Encontro", não excluída
  - Quando alguém cadastra " encontro " ou "Encôntro"
  - Então recebe "Já existe uma escola com este nome.".
  - Se a escola "Encontro" estiver excluída, o cadastro é aceito.
- **ESC-03** (valor proposto)
  - Dada uma escola com 4 aulas
  - Quando o gestor dá título às aulas e troca a ordem das aulas 2 e 3
  - Então as turmas criadas depois mostram as aulas na nova ordem, numeradas de 1 a 4.
- **ESC-04** (valor proposto)
  - Dada a escola "Capacitação Destino – Nível 2", que exige o Nível 1, e um membro sem a certificação do Nível 1
  - Quando o gestor tenta matriculá-lo numa turma do Nível 2, pela tela ou pela API
  - Então a matrícula é recusada com "Falta concluir: Capacitação Destino – Nível 1.".
  - Dado o mesmo membro já com a certificação do Nível 1 (de uma turma ou concedida manualmente)
  - Quando o gestor o matricula
  - Então a matrícula é aceita.
  - Dado que o Nível 2 exige o Nível 1
  - Quando o gestor tenta fazer o Nível 1 exigir o Nível 2
  - Então recebe "Os pré-requisitos não podem formar um ciclo.".
  - Dada uma certificação do Nível 1 que foi excluída
  - Então ela não conta como pré-requisito.
- **ESC-05** (valor proposto)
  - Dada uma escola inativa, com uma turma em andamento e 30 certificações
  - Quando o gestor tenta criar uma turma nova dela
  - Então recebe "Esta escola está inativa.".
  - A turma existente continua aceitando chamada, e as 30 certificações continuam nos cadastros.
- **ESC-06**
  - Dado o gestor
  - Quando ele tenta salvar uma turma sem escola, mesmo pela API
  - Então nada é gravado ("Escolha a escola da turma.").
  - Dadas duas turmas da mesma escola
  - Então cada uma tem os próprios alunos e a própria chamada.
- **ESC-07**
  - Dado o gestor
  - Quando ele informa início em 10/03/2027 e fim em 09/03/2027
  - Então recebe "A data de fim não pode ser anterior à data de início.".
  - Com início e fim no mesmo dia, a turma é salva.
  - Sem data de início ou sem data de fim, nada é gravado.
- **ESC-08** (valor proposto)
  - Dada a escola X com 10 aulas e a turma T criada a partir dela
  - Quando a escola passa a ter 12 aulas
  - Então T continua com 10 aulas, e uma turma criada depois tem 12.
  - Dada a turma T, de 01/02 a 30/04
  - Quando o gestor marca uma aula para 02/05
  - Então recebe "A data da aula precisa estar dentro do período da turma.".
  - Dada a turma T com um aluno
  - Quando o gestor tenta trocar a escola da turma
  - Então recebe "Não é possível trocar a escola de uma turma que já tem alunos.".
- **ESC-09** (valor proposto)
  - Dado o membro P, definido como professor da turma T
  - Então P aparece como professor de T e pode ser aluno de outra turma.
- **ESC-10** (valor proposto)
  - Dada a turma T encerrada
  - Quando o gestor tenta matricular um aluno, lançar a chamada ou mudar uma situação
  - Então recebe "Esta turma está encerrada.".
  - Depois de reabrir a turma, ele consegue.
- **ESC-11**
  - Dados um membro ativo sem líder, um pastor e um membro casado
  - Quando o gestor os matricula na turma T
  - Então os três ficam na turma.
  - Dado o membro M, já matriculado na turma T
  - Quando o gestor tenta matriculá-lo de novo em T
  - Então recebe "Este membro já está nesta turma.".
  - Dado M na turma T1, da escola A
  - Quando ele é matriculado na turma T2, da escola B
  - Então fica nas duas turmas.
  - Dado um membro excluído
  - Então ele não aparece no seletor de alunos, e a matrícula feita pela API é recusada.
  - Dado um consolidado (quando a feature existir)
  - Então ele não aparece no seletor de alunos até a P-12 ser respondida.
- **ESC-12** (valor proposto)
  - Dado um membro inativo
  - Então ele não aparece no seletor de alunos, e a matrícula feita pela API é recusada.
  - Dado um aluno que fica inativo no meio da turma
  - Então a matrícula, as presenças e a situação dele continuam, e a chamada dele ainda pode ser lançada.
- **ESC-13** (valor proposto)
  - Dado M "Em andamento" na turma T1, da escola A
  - Quando o gestor tenta matriculá-lo na turma T2, também da escola A
  - Então recebe "Este membro já está cursando esta escola (turma T1).".
  - Dado M com a certificação da escola A
  - Quando o gestor tenta matriculá-lo numa turma de A
  - Então recebe "Este membro já concluiu esta escola.".
- **ESC-14**
  - Dada a turma T com 10 aulas e 5 alunos
  - Quando o gestor lança a chamada da aula 3 com 4 presentes e 1 ausente
  - Então a aula 3 fica com exatamente 5 registros, e as outras aulas aparecem como "Não lançada".
  - Quando ele lança de novo a chamada da aula 3, mudando o ausente para presente
  - Então continuam 5 registros, e esse aluno passa a "Presente".
- **ESC-15**
  - Dado um usuário sem "Gerenciar Escolas" que não é professor da turma
  - Quando ele tenta gravar uma presença pela API
  - Então recebe erro de permissão (42501) e nada muda. Na tela, ele não vê a chamada.
  - Dado um aluno
  - Quando ele tenta marcar a própria presença pela API
  - Então recebe erro de permissão.
- **ESC-16** (valor proposto)
  - Dado o professor P da turma T, sem "Gerenciar Escolas"
  - Quando ele lança a chamada de T
  - Então a chamada é gravada.
  - Quando ele tenta lançar a chamada da turma T2, da qual não é professor
  - Então recebe erro de permissão.
- **ESC-17** (valor proposto)
  - Dada a aula 4 da turma T, marcada para o sábado, 13/03/2027
  - Quando o gestor tenta lançar a chamada na sexta, 12/03, às 23:59 (horário de Brasília)
  - Então recebe "Não é possível lançar a chamada de uma aula que ainda não aconteceu.".
  - Quando ele tenta no sábado, 13/03, às 00:00 (horário de Brasília)
  - Então a chamada é gravada, mesmo que o navegador esteja em outro fuso.
- **ESC-18** (valor proposto)
  - Dado um aluno ausente na aula 2
  - Quando o gestor registra a justificativa "Plantão no trabalho"
  - Então a aula 2 aparece como "Ausente (justificada)" e continua contando como falta.
  - Quando o gestor registra a reposição da aula 2
  - Então a aula 2 passa a contar como presença.
- **ESC-19**
  - Dado um membro que acabou de ser matriculado
  - Então a situação dele na turma é "Em andamento".
  - Quando alguém tenta gravar pela API uma situação que não seja Em andamento, Aprovado ou Reprovado
  - Então nada é gravado.
- **ESC-20** (valor proposto: frequência mínima de 70%)
  - Dada a escola A, com frequência mínima de 70%, e a turma T, com 10 aulas
  - Quando o gestor encerra T
  - Então o sistema propõe "Aprovado" para quem tem 7 ou mais presenças e "Reprovado" para quem tem 6 ou menos.
  - Quando o gestor muda um aluno de "Reprovado" para "Aprovado" informando o motivo
  - Então a mudança é gravada com o motivo. Sem motivo, ela é recusada.
- **ESC-21**
  - Dado M "Reprovado" na turma T, da escola A, sem nenhuma outra certificação de A
  - Então o cadastro de M não mostra a escola A em "Escolas concluídas", e A não conta como pré-requisito para M.
- **ESC-22** (valor proposto)
  - Dado M "Reprovado" na turma T1, da escola A
  - Quando ele é matriculado na turma T2, também da escola A, e aprovado
  - Então M recebe a certificação de A ligada à T2, e o histórico continua mostrando "Reprovado" na T1.
- **ESC-23**
  - Dado M "Em andamento" na turma T, da escola A
  - Quando o gestor muda a situação para "Aprovado"
  - Então M passa a ter a certificação de A, ligada a T e com a data de conclusão, e ela aparece no cadastro dele.
  - Se a certificação não puder ser gravada, a situação também não muda.
- **ESC-24**
  - Dado M com a certificação da escola A
  - Quando qualquer operação tenta criar uma segunda certificação de A para M (outra turma, concessão manual ou duas aprovações ao mesmo tempo)
  - Então M continua com uma única certificação de A.
- **ESC-25**
  - Dado M com as certificações de "Pré-Encontro" e "Encontro"
  - Quando M abre "Editar meus dados", ou quando alguém que vê M abre o cadastro dele
  - Então vê "Escolas concluídas" com as duas escolas e as datas de conclusão.
  - Uma certificação excluída não aparece.
- **ESC-26** (valor proposto)
  - Dado M "Aprovado" na turma T, com a certificação de A gerada por T
  - Quando o gestor muda a situação para "Reprovado"
  - Então a certificação recebe exclusão lógica, some do cadastro e deixa de contar como pré-requisito.
  - A Auditoria registra a mudança.
- **ESC-27** (valor proposto)
  - Dado o gestor
  - Quando ele concede a M a certificação de "Encontro", com data de 10/05/2019 e a observação "Encontro de 2019, antes do sistema"
  - Então M tem a certificação marcada "Concedida manualmente", sem turma, e ela conta como pré-requisito.
  - Uma data de conclusão futura é recusada.
  - Um usuário sem "Gerenciar Escolas" que tenta conceder a certificação pela API recebe erro de permissão.
- **ESC-28**
  - Dada a tela de Funções
  - Então ela lista "Gerenciar Escolas".
  - Dado um usuário cuja função não tem essa permissão
  - Quando ele tenta criar, editar ou excluir escola, turma, matrícula, chamada, situação ou certificação pela API
  - Então recebe erro de permissão (42501).
  - Dada a função Administrador (`is_system`)
  - Então ela tem a permissão também no banco.
- **ESC-29** (valor proposto: igreja toda)
  - Dado um gestor de escolas com escopo de ministério (`view_own_ministry`)
  - Quando ele busca alunos no seletor
  - Então encontra membros ativos de qualquer ministério, e dos que estão fora do seu escopo vê só o nome.
- **ESC-30** (valor proposto)
  - Dado o aluno M
  - Quando ele abre as próprias escolas
  - Então vê as próprias turmas, presenças, situações e certificações, e nenhum dado de outros alunos.
  - Dado um líder com `view_own_ministry` e M em outro ministério
  - Então o líder não vê as certificações de M.
  - Dado um usuário sem "Gerenciar Escolas" que não é professor
  - Quando ele lê turmas ou chamadas pela API
  - Então recebe só as próprias matrículas.
- **ESC-31**
  - Dada a turma T, com 20 alunos
  - Quando o gestor exclui a turma
  - Então T some da lista de turmas e das contagens.
  - Uma tentativa de apagar T fisicamente pela API é recusada.
  - Uma certificação excluída não aparece no cadastro nem conta como pré-requisito.
- **ESC-32** (valor proposto)
  - Dada a escola A, com uma turma não excluída
  - Quando o gestor tenta excluir A
  - Então recebe "Exclua as turmas desta escola antes." e a escola continua.
  - Dada a turma T, com um aluno "Aprovado"
  - Quando o gestor tenta excluir T
  - Então recebe "Esta turma tem alunos aprovados. Desfaça as aprovações antes de excluí-la.".
- **ESC-33**
  - Dado M, matriculado na turma T e com a certificação da escola A
  - Quando M é excluído
  - Então ele some da lista de alunos de T e das contagens, e a certificação dele não aparece em lugar nenhum.
  - Quando M é reativado (DEL-09)
  - Então a matrícula, as presenças e a certificação voltam como estavam.
- **ESC-34**
  - Dado o gestor G
  - Quando ele muda a presença de M na aula 3 da turma T de "Ausente" para "Presente"
  - Então a Auditoria mostra G, o horário, a turma, a aula, o aluno e os valores antes e depois.
- **ESC-35** (valor proposto)
  - Dados o marido M e a esposa E na turma T
  - Quando M é aprovado e E é reprovada
  - Então só M recebe a certificação.

### Textos de tela (proposta)
- **Menu e telas:**
  - Menu: "Escolas", com as telas "Escolas" e "Turmas".
  - No cadastro do membro: a seção "Escolas concluídas".
- **Campos:** Nome da escola, Quantidade de aulas, Frequência mínima (%), Pré-requisitos, Escola, Início das aulas, Fim das aulas, Professor(es), Alunos e Chamada.
- **Valores:**
  - Presença: Presente, Ausente, Ausente (justificada) e Não lançada.
  - Situação: Em andamento, Aprovado(a) e Reprovado(a).
  - Certificação: Concluída em e Concedida manualmente.
- **Termos a evitar na tela:**
  - "badge": usar "Certificação" ou "Escolas concluídas";
  - "curso": usar "escola";
  - anglicismos em geral.

### Fora de escopo
- Consolidados (potenciais membros) e visitantes como alunos. Depende da feature Consolidação (P-12).
- Material por turma (arquivos ou links), embora o `CLAUDE.md` cite. Depende da P-18.
- Provas, notas e trabalhos.
- Inscrição feita pelo próprio membro, vagas e lista de espera.
- Taxas e pagamentos (material, Encontro).
- Certificado em PDF, impressão e formatura.
- Notificações.
- Usar as certificações em outras regras: requisito para ser líder, timóteo ou anfitrião; filtro de Membros; cards no Dashboard (P-21).
- Marcar "batizado" automaticamente ao concluir a Universidade da Vida (P-22).
- Logística do Encontro como evento (inscrição, hospedagem, equipes).
- Migração do legado: o legado não tem escolas. A carga histórica está na ESC-27.

### Perguntas em aberto
As perguntas da seção 4 deste arquivo, na mesma ordem de prioridade.
````

---

## 4. Perguntas em aberto, priorizadas

As marcadas com ✅ foram respondidas pelo usuário em 2026-11-22. As respostas estão no plano.

**Bloqueiam a modelagem (responder primeiro):**

1. **P-01 Catálogo e granularidade.**
   - Quais escolas a igreja tem hoje, com os nomes oficiais, o número de aulas e a ordem?
   - Na Capacitação Destino, a escola (e a certificação) é cada **nível** (3), cada **módulo ou livro** (6) ou a **Capacitação inteira** (1)?
   - A Universidade da Vida é uma escola só, ou Pré-Encontro, Encontro e Pós-Encontro ficam separados?
2. ✅ **P-02 Aulas.** Resposta (D-ESC-5): lista de aulas com título opcional, copiada para a turma, com data opcional por aula. Não se lança chamada de aula futura.
   - A escola tem só um número X de aulas ou uma lista com título e ordem?
   - A turma tem uma data para cada aula ou só o período?
   - A chamada é por **reunião** ou por **lição**? Na CD, uma reunião costuma cobrir 2 lições.
3. ✅ **P-03 Aprovação.** Resposta: só manual.
   - Continua em aberto: a data de conclusão é o fim da turma ou o dia em que o gestor aprovou?
4. ✅ **P-05 Refazer.** Resposta (D-ESC-7): o reprovado e quem já concluiu podem refazer, e cada membro mantém uma única certificação por escola.
   - O reprovado pode refazer a escola em outra turma?
   - O membro pode estar em duas turmas da mesma escola ao mesmo tempo?
   - Quem já concluiu pode refazer? Se puder, continua com uma certificação ou fica com duas?
5. ✅ **P-06 Pré-requisitos.** Resposta: entram na v1.
   - Continua em aberto: o gestor pode abrir exceção? Batismo e participação em célula também são pré-requisitos?
6. ✅ **P-07 Permissões e escopo da gestão.** Resposta: o professor lança a chamada da própria turma.
   - Continua em aberto: uma permissão só ou várias? A gestão vale para a igreja toda ou cada ministério cuida das suas turmas?
7. ✅ **P-08 Visibilidade.** Resposta: as certificações seguem o mesmo escopo de Membros.
8. **P-11 Ciclo da turma.**
   - A turma tem status (planejada, em andamento, encerrada), e a encerrada trava a chamada?
   - Precisa das situações "Desistente" ou "Cancelada"?
9. **P-12 Encontro, Reencontro e não membros.** Parte respondida (D-ESC-6): só membros são alunos, e quem ainda não é membro é cadastrado antes. Ainda em aberto: Encontro e Reencontro são escolas (ver P-01)?
   - Encontro e Reencontro são "escolas", com certificação?
   - Os novos convertidos da UV e do Pré-Encontro ainda não são membros. Isso faz Escolas depender da Consolidação?
   - Visitantes podem ser alunos?
10. **P-09 Professor.** (Já se sabe que existe: o professor lança a chamada.)
    - É sempre membro? Pode haver mais de um?
    - Como a igreja chama: Professor, Mestre ou Facilitador?
11. ✅ **P-10 Carga histórica.** Resposta: a certificação manual entra na v1.
    - Continua em aberto: quem informa, com que data e a partir de qual fonte (planilhas)? Em lote?

**Bloqueiam regras específicas:**
- ✅ **P-04** Falta justificada e reposição. Resposta: entram na v1, e a reposição conta como presença.
- **P-13** Membro inativo pode ser matriculado?
- **P-14** Casal: matrícula e certificação são individuais?
- **P-15** Desfazer uma aprovação apaga a certificação?
- **P-16** Excluir escola ou turma que já tem turmas, alunos ou aprovados.
- **P-17** Dados da turma: nome ou código (ex.: "2027.1"), dia e horário, local, presencial ou online, vagas. Até quando se aceita matrícula?
- ✅ **P-18** Material por turma. Resposta (D-ESC-8): só um texto descritivo (por exemplo, livros a comprar), sem arquivos nem links.

**Podem esperar:**
- **P-19** Termo de tela: "Certificação" no lugar de "badge"?
- **P-20** A igreja é da rede G12 (Castellanos, Editora G12) ou M12 (Ap. Renê Terra Nova)? A resposta muda os nomes do catálogo da P-01.
- **P-21** Usar as certificações no filtro de Membros, no Dashboard e como requisito para liderar célula.
- **P-22** Concluir a UV marca o membro como batizado?
- ✅ **P-23** Cronograma. Resposta: o spec é escrito agora e o código vem depois da fase 7.

---

## 5. Pontos para o `architect`

1. **Dependências.**
   - ESC-31 e ESC-33 dependem do padrão de exclusão lógica do E2.01 (RPC de exclusão, índices parciais, reativação).
   - ESC-29 e ESC-30 dependem do escopo do E2.02.
2. **Permissões novas.**
   - Entram no enum `permission_action` e nos rótulos de `mci-connect/src/pages/Roles.tsx`.
   - O front libera tudo para `is_system`, mas o RLS não faz isso. Por isso a ESC-28 exige a permissão gravada no banco, como a RN-14 do E1.08.
3. **Unicidade sob concorrência.**
   - Quatro garantias precisam estar no banco:
     - presença única por (matrícula, aula);
     - aluno único por (turma, membro) entre os registros não excluídos;
     - certificação única por (membro, escola) entre as não excluídas;
     - no máximo uma matrícula "Em andamento" por (membro, escola).
   - Motivo: dois gestores podem aprovar ou lançar a chamada ao mesmo tempo.
4. **Operações atômicas.**
   - Aprovação e certificação (ESC-23, ESC-26) são gravadas juntas, numa RPC.
   - A chamada de uma aula é gravada em lote, numa só operação. Assim não se repete o problema da regravação de participantes.
5. **Pré-requisitos (ESC-04).**
   - A checagem e a detecção de ciclo ficam no banco.
   - Ambas ignoram certificações excluídas.
6. **Aulas e datas.**
   - As aulas da escola são copiadas para a turma (ESC-08).
   - As datas são calculadas em `America/Sao_Paulo` (ESC-17).
7. **Visibilidade das certificações.**
   - Decidir entre a `members_view` (security definer, com o `WHERE` espelhando o RLS) e uma view própria com o mesmo escopo.
   - Os nomes de membros fora do escopo seguem o padrão da `member_names`.
8. **Limite de 1000 linhas do PostgREST.** As listas de turmas e de alunos e o seletor de membros paginam no servidor, no padrão da RN-07 do E1.08.
9. **Auditoria (ESC-34).**
   - Os triggers `_log_event` passam a cobrir as tabelas novas.
   - A chamada gera muitos eventos (30 alunos × 20 aulas), então o volume precisa ser avaliado.
10. **Consolidação.** Se consolidados puderem ser alunos no futuro, a flag precisa ser tratada em todas as consultas de Escolas.
11. **Carga histórica (ESC-27).** Importação em lote, por script ou RPC, com a origem "manual" e o autor registrados.
12. **Conflito do termo "encontro" nas telas atuais.**
    - Hoje o app usa "encontro" para a reunião da célula:
      - "Detalhes do Encontro" e "Algo a pontuar sobre o encontro?", em `mci-connect/src/components/CellReportForm.tsx` (linhas 374 e 456);
      - "relatórios de encontros das células", em `mci-connect/src/pages/CellReports.tsx:182`.
    - Com Escolas, "Encontro" passa a ser o retiro.
    - Sugestão: "Detalhes da reunião", "Algo a pontuar sobre a reunião?" e "Relatórios semanais das células". É um PR à parte.

---

## Fontes

**Oficiais G12** (base de conhecimento e G12 Brasil)
- [Pré-encontro](https://conocimiento.g12.co/portal/pt/kb/articles/o-que-%C3%A9-o-pr%C3%A9-encontro)
- [Pós-encontro](https://conocimiento.g12.co/portal/pt/kb/articles/o-que-%C3%A9-o-p%C3%B3s-encontro)
- [Universidade da Vida (base)](https://conocimiento.g12.co/portal/pt/kb/articles/o-que-%C3%A9-a-universidade-da-vida)
- [Universidade da Vida (G12 Brasil)](https://g12brasil.com/o-que-e-a-universidade-da-vida/)
- [Capacitação Destino (pt)](https://conocimiento.g12.co/portal/pt/kb/articles/o-que-%C3%A9-a-capacita%C3%A7%C3%A3o-destino)
- [Capacitación Destino (es)](https://conocimiento.g12.co/portal/es/kb/articles/qu%C3%A9-es-capacitaci%C3%B3n-destino)
- [Onde começa e termina o discipular](https://conocimiento.g12.co/portal/es/kb/articles/d%C3%B3nde-empieza-y-d%C3%B3nde-termina-el-discipular)

**Editora G12**
- [Capacitação Destino (6 livros)](https://editorag12.com/site/categoria-produto/capacitacao-destino/)
- [Kit Mestre](https://editorag12.com/site/produto/kit-mestre-capacitacao-destino/)
- [Universidade da Vida](https://editorag12.com/site/categoria-produto/universidade-da-vida/)

**Igrejas MCI**
- [MCI Sabana Norte](https://www.mcisabananorte.com/capacitacion-destino)
- [MCI Zipaquirá](https://mcizipaquira.com/timo/)
- [MCI Durango – CD](https://mcidurango.com/capdestino/)
- [MCI Durango – UV](https://mcidurango.com/udelavida/)
- [MCI Constitución](https://mciconstitucion.cl/cap/)
- [Visión de Dios](https://www.visiondedios.com/formacion)

**Igrejas no Brasil**
- [Church Vilas – CD Nível 1](https://www.sympla.com.br/evento-online/capacitacao-destino-turma-2022-1-nivel-1-as-16h/1479943)
- [Church Vilas – CD Nível 2](https://www.sympla.com.br/evento-online/curso-de-capacitacao-destino-nivel-2-turma-2022-1/1557305)
- [Fazei Discípulos](https://igrejafazeidiscipulos.wordpress.com/capacitacao-destino/)
- [Comunidade Vitória – Escada do Sucesso](http://comunidadevitoria.visualmaster.com.br/visao/escada.htm)
- [IAR – Escola de Líderes](https://apostolicanovametropole.webnode.com.br/ministerios/escola-de-lideres/)
- [Sympla – Universidade da Vida](https://www.sympla.com.br/evento-online/universidade-da-vida/1328512)

**Outras igrejas**
- [Agua de la Roca](https://aguadelaroca.es.tl/CAPACITACI%D3N-DESTINO.htm)
- [Nueva Vida Irapuato](https://www.nuevavidairapuato.com/capacitacion.html)

**Fonte crítica ao movimento**
- [Apostasía al día](https://www.apostasiaaldia.org/2014/05/un-encuentro-con-los-encuentros-del-g12.html)

**Afiliação**
- [MCI – Wikipédia](https://pt.wikipedia.org/wiki/Miss%C3%A3o_Carism%C3%A1tica_Internacional)
- [Renê Terra Nova / MIR (ICAL Brasil)](https://www.icaleaders.com/brazil)

**Outro software** (referência de produto, não de doutrina)
- [PastorAI PR #498](https://github.com/haniellevi/PastorAI-LionClaw-V1/pull/498)
- [PastorAI PR #499](https://github.com/haniellevi/PastorAI-LionClaw-V1/pull/499)
