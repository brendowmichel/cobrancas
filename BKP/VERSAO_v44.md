# v44 - 2026-06-23

## Mudancas

- Removidos os filtros rapidos abaixo do campo de busca por nome.
- Mantidos os filtros existentes pelos cards superiores de status.
- Agendamento vencido agora altera o proprio chip `AGENDADO` para `AG. VENCIDO`.
- Removida a tag adicional `AG. VENCIDO` do nome do cliente para evitar conflito com tags de cadastro.
- Data do agendamento fica imediatamente ao lado do chip de status.

## Validacao

- Sintaxe do `cobrancas.gs` validada via Node.
- HTML servido validado com scripts inline e handlers compilados.
