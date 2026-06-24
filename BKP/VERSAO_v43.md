# v43 - 2026-06-23

## Mudancas

- Dashboard de cobranca mais compacta, com menor altura nas linhas da tabela.
- Coluna `Duplicatas` renomeada para `Qtd.` e valores centralizados.
- Larguras das colunas principais padronizadas por `colgroup`.
- Botoes `Resumo` e `Status` trocados por icones com tooltip.
- Filtros rapidos por status adicionados acima da tabela.
- CPF/CNPJ formatado na listagem, no modal de status e no resumo copiado.
- Status de contato passa a exibir a data de agendamento ao lado do chip.
- Observacao do cliente passa a ocupar ate duas linhas com tooltip para texto completo.
- Agendamentos vencidos recebem a tag `AG. VENCIDO` e destaque lateral na linha.

## Validacao

- Sintaxe do `cobrancas.gs` validada via Node.
- HTML servido validado com scripts inline e handlers compilados.
