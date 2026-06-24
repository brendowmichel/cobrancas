# VERSAO v13 - 2026-06-11

## Mudancas

- Dashboard passa a carregar dados da aba `Clientes` junto com os inadimplentes.
- Status de cadastro (`SUSPENSO`, `CANCELADO`, `PROTESTADO`) aparecem como tags ao lado do nome do cliente.
- Status de contato (`EM ABERTO`, `EM CONTATO`, `AGENDADO`) aparecem na nova coluna `Status`.
- A observacao do cliente aparece abaixo do status de contato.
- Adicionado botao `Status` na coluna de acoes.
- Adicionada funcao publica `atualizarStatusCliente(payload)` para gravar status e observacao na aba `Clientes`.
- Mantido o botao `Copiar resumo` na coluna de acoes.

## Validacao

- Sintaxe do `cobrancas.gs` validada com Node.js.
- Sintaxe do JavaScript embutido no Web App validada com Node.js.
