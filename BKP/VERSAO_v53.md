# Versao v53 - 2026-06-24

## Resumo

Ajuste visual na dashboard do Google Apps Script para clientes com agendamento vencido.

## Mudancas

- Incrementado `APP_VERSION` para `v53`.
- Linhas com `AG. VENCIDO` agora recebem estado visual especifico quando abertas.
- O hover/selecionado de agendamento vencido escurece o vermelho, em vez de usar o cinza/azulado generico da tabela.
- Adicionada classe `is-open` na linha principal ao abrir o detalhamento.

## Validacao

- Sintaxe validada com `new Function`.
- Integridade conferida: arquivo acima de 2000 linhas e `function isBlankRow_` presente.

