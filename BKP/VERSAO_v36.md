# Versao v36 — 2026-06-12

## Novidade: grupo separado para "Desconsiderados"

Clientes com `status_cadastro = DESCONSIDERADO` deixam de aparecer na lista de
inadimplentes e passam a ter uma secao propria.

### Comportamento
- `inadimplentesView` agora exclui `DESCONSIDERADO` (alem de FINALIZADO).
- Novo `desconsideradosView` = clientes DESCONSIDERADO, nao finalizados, com 2+ duplicatas.
- Nova secao "Desconsiderados" (tabela igual a de Finalizados), exibida so quando ha registros,
  com contagem de clientes e total somado no cabecalho.
- Os graficos (populacao de inadimplentes) tambem passam a excluir DESCONSIDERADO, entao a
  categoria some do grafico de cadastro (vira o grupo proprio).
- `toggleDetalheCliente` foi generalizado para abrir o detalhe das duplicatas em qualquer
  tabela (inadimplentes, finalizados e desconsiderados) — antes so funcionava na de inadimplentes.

### Escopo
- Apenas camada de apresentacao (`getWebAppHtml_`). Backend e dados inalterados; os totais ja
  excluiam PERMUTA/DESCONSIDERADO do "Total vencido ajustado" desde a v19.

## Verificacao
- `node --check` no .gs: OK.
- HTML SERVIDO (template avaliada): ambos os `<script>` e todos os handlers inline compilam.
- 2709 linhas, sem bytes nulos, fecha com `}`. Patch via Python.
