# Versao v33 — 2026-06-12

## Novidade: filtro por clique nas categorias dos graficos

Os dois cards de grafico (STATUS DE CONTATO e STATUS DE CADASTRO) agora sao interativos.

- Clicar numa categoria da legenda (ex.: AGENDADO, SUSPENSO, PERMUTA) filtra a tabela de inadimplentes mostrando apenas os clientes com aquele status.
- Clicar de novo na mesma categoria remove o filtro.
- O filtro de categoria combina com o filtro de texto por nome.

### Feedback visual
- Categoria ativa: fundo `primary-container` + anel interno na cor primaria.
- Demais categorias e segmentos da barra: esmaecidos (opacity reduzida) enquanto ha filtro ativo.
- Hover nas categorias com realce de superficie.
- A linha de informacao da lista (`lista-info`) passa a indicar o filtro ativo e como limpar.

### Implementacao (apenas frontend, dentro de getWebAppHtml_)
- Novo estado global `filtroCategoria` (`{ campo, valor }` ou `null`).
- `buildGrafico_` recebe o `campo` (`status_contato` / `status_cadastro`) e renderiza a legenda como botoes (`toggleFiltroCategoria`).
- `toggleFiltroCategoria(campo, valor)` alterna o filtro, reaplica `filtrarInadimplentes` e re-renderiza os graficos para refletir a selecao.
- `filtrarInadimplentes` passa a aplicar categoria + texto. Para contato, `status_contato` vazio conta como `EM ABERTO`.
- Nenhuma alteracao no backend ou no fluxo de dados.

## Incidente de integridade
Durante a edicao com ferramenta de texto, o `cobrancas.gs` foi truncado no meio (linha ~2561, dentro de `normalizeDate_`) e numa rodada anterior recebeu bytes nulos no fim. Recuperado a partir de `BKP/cobrancas_v32.gs` e reaplicado integralmente via patch Python (substituicoes cirurgicas), conforme as regras de edicao segura do projeto.

## Verificacao
- `node --check`: sintaxe OK.
- 2641 linhas, termina com `}`, `isBlankRow_` presente, sem bytes nulos.
