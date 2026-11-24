# <Nome da feature>

> Status: rascunho | em refinamento | pronto para desenvolvimento | em desenvolvimento | aceito
> Slug: `<slug>` · Paridade com o legado: sim/não

<!--
Tamanho máximo: 60 KB no total (confira com `wc -c`).
- Negócio: até 20 KB. Experiência (UX): até 15 KB. Solução técnica e Tarefas: até 20 KB. Testes: até 5 KB.
- Cite padrões, regras e decisões de outros specs pelo ID, sem copiar o texto.
- Não repita o CLAUDE.md nem o docs/migracao.md: cite a seção.
- Os agentes leem o spec por seção, então mantenha os títulos abaixo.
-->



## Negócio
_Seção do `product-owner`._

### Contexto e objetivo

### Personas e permissões

### Histórias
- Como <persona>, quero <ação>, para <benefício>.

### Regras de negócio
| ID | Regra | Origem |
|---|---|---|
| RN-01 | | legado (`arquivo:linha`) / definida pelo usuário (data) / a confirmar |

### Critérios de aceite
- **RN-01**
  - Dado …
  - Quando …
  - Então …

### Fora de escopo

### Perguntas em aberto

## Experiência (UX)
_Seção do `ux-designer`. Omita quando a feature não tiver tela._

### Fluxos
- <história>: entrada → … → confirmação (n toques)

### Telas
Wireframe de cada tela ou diálogo: primeiro no mobile (360 px), depois no desktop (≥ 1024 px), com o que muda em cada breakpoint e os componentes do shadcn/ui.

### Estados
Carregando, vazio, erro, sem permissão, sucesso, lista grande e queda de conexão no envio.

### Textos
| Onde | Texto |
|---|---|

### Critérios de UX
| ID | Critério | Como verificar |
|---|---|---|
| UX-01 | | teste (viewport) / inspeção |

## Solução técnica
_Seção do `architect`._

### Modelo de dados e migrations

### Onde cada regra é imposta
| RN | Banco (constraint, RLS, trigger, RPC) | UI |
|---|---|---|

### Contratos (RPC, Edge Functions, colunas novas)

### Riscos (concorrência, escala, segurança)

## Tarefas
_Seção do `architect`._

| # | Responsável | Descrição | Arquivos | RNs | Depende de |
|---|---|---|---|---|---|

## Testes
_Seção do `qa`. Só a tabela e uma linha de resultado por PR; a saída dos comandos vai no PR._

| RN | Testes | Resultado |
|---|---|---|
