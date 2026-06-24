# Versao v57 - 2026-06-24

## O que mudou

- Tags de status de cadastro foram movidas do lado do nome do cliente para o lado do CNPJ/CPF.
- Criado helper `clienteDocumentoHtml()` para manter a montagem do documento com tag consistente entre inadimplentes, finalizados e desconsiderados.
- A linha de CNPJ/CPF passou a usar `inline-flex` com quebra controlada para acomodar a tag sem apertar o nome.

## Arquivos alterados

- `cobrancas.gs`
- `instructions.md`

## Validacao

- Validar sintaxe JavaScript do Apps Script.
- Confirmar snapshot em `BKP/cobrancas_v57.gs`.
