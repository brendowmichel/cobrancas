# VERSAO v14 - 2026-06-11

## Mudancas

- Dashboard passa a agrupar visualmente duplicatas do mesmo cliente com mesmo RPS/numero e vencimento.
- Valores agrupados sao somados em uma unica linha.
- Categorias diferentes aparecem juntas na linha agrupada, separadas por `+`.
- Linhas agrupadas exibem a quantidade de itens internos agrupados.
- O resumo copiado tambem usa as duplicatas agrupadas.
- A `Base_Cobrancas` continua preservando as linhas detalhadas por categoria/valor.

## Validacao

- Sintaxe do `cobrancas.gs` validada com Node.js.
- Sintaxe do JavaScript embutido no Web App validada com Node.js.
