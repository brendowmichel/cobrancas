# VERSAO v12 - 2026-06-11

## Mudancas

- Adicionada a aba `Clientes` como cadastro consolidado por `cnpj_cpf`.
- A importacao agora cria e atualiza o cadastro de clientes automaticamente.
- Clientes novos entram com `status_cobranca = EM ABERTO` e `tipo_status = CONTATO`.
- Status de contato definidos: `EM ABERTO`, `EM CONTATO`, `AGENDADO`.
- Status de cadastro definidos: `SUSPENSO`, `CANCELADO`, `PROTESTADO`.
- Campos manuais do cadastro (`status_cobranca`, `responsavel`, `observacao`) sao preservados nas proximas importacoes.
- Dashboard passou a ter coluna `Acoes` na tabela principal.
- Botao `Copiar resumo` foi movido para a coluna de acoes da linha do cliente.
- Detalhe expandido nao repete mais nome, documento, quantidade e valor total.
- Tabela principal agora pode ser classificada por nome, duplicatas vencidas e valor total.
- Ordenacao padrao da dashboard mantida por maior valor total vencido.

## Validacao

- Sintaxe do `cobrancas.gs` validada com Node.js.
- Sintaxe do JavaScript embutido no Web App validada com Node.js.
