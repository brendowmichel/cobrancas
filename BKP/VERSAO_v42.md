# VERSAO v42 - 2026-06-19

## Relatorios continuos

- Relatorio resumido passa a usar uma unica folha continua com largura de `210 mm`.
- Relatorio detalhado passa a usar uma unica folha continua com largura de `297 mm`.
- Altura calculada dinamicamente conforme clientes, observacoes e duplicatas.
- Altura maxima limitada a `5000 mm`.
- Removidos rodape fixo e contador CSS de pagina.
- Corrigidos vazamento do rodape e texto `Pagina 0`.

## Detalhado compacto

- Numero/RPS e parcela combinados em uma coluna.
- Vencimento e atraso combinados em uma coluna.
- Mantidas categoria, saldo a receber e status.
- Removidas colunas de valor original e recebido.
- Removidos cabecalhos e totais repetidos por cliente.
- Status, documento, observacao, quantidade e total ficam em um cabecalho compacto.

## Validacao

- Sintaxe do Apps Script validada.
- HTML servido e os 20 handlers validados.
- Simulacao com 33 clientes e 197 duplicatas:
  - resumido: folha `210 mm x 759 mm`;
  - detalhado: folha `297 mm x 1884 mm`.
- Confirmada ausencia de `counter(page)`, rodape fixo e tamanho A4 paginado.
