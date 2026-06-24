# v18 - 2026-06-11

## Alterações

### Exclusão física de registros pagos na importação

- Registros presentes na `Base_Cobrancas` que **não aparecem** na nova importação são agora **excluídos fisicamente** da planilha, em vez de receber `ativo_na_ultima_importacao: NAO`.
- A exclusão só ocorre se a importação contiver pelo menos 1 registro (segurança contra arquivos vazios).
- Linhas são deletadas em ordem decrescente de índice para evitar deslocamento de linhas durante a exclusão.
- O resumo de importação exibido no toast passa a incluir a contagem de registros removidos (`X removidos (pagos/quitados)`).
- A aba `Clientes` continua preservada: histórico de status, observações e datas de agendamento são mantidos mesmo após quitação de todas as duplicatas de um cliente.
