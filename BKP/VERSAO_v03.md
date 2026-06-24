# Versao v03 - 2026-06-11

## O que mudou

- Incrementada a versao do script para `v03`.
- Adicionado campo de upload de Excel no Web App.
- Criada a funcao `importarArquivoExcelUpload(payload)` para receber arquivo em base64.
- Adicionada conversao temporaria do Excel para Google Sheets usando o servico avancado Drive API.
- A importacao passa a usar a primeira aba da planilha temporaria convertida.
- Melhorada a mensagem de erro quando uma aba sem cabecalho e importada.
- Criado `google_script_fixes.md` como base de conhecimento de erros e correcoes.
- Registrados os fixes do erro `doGet` ausente e do fluxo que exigia dados colados na aba `Importacao`.

## Arquivos da versao

- `BKP/cobrancas_v03.gs`
