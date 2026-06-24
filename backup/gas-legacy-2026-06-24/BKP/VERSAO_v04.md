# Versao v04 - 2026-06-11

## O que mudou

- Incrementada a versao do script para `v04`.
- Removida a dependencia da Drive API no fluxo principal de upload de Excel.
- O upload principal passa a aceitar `.xlsx` e ler o arquivo internamente com `Utilities.unzip` e `XmlService`.
- Criado parser interno para `workbook.xml`, `sharedStrings.xml` e primeira planilha do `.xlsx`.
- O importador foi separado para aceitar tanto valores vindos de uma aba quanto valores lidos diretamente do Excel.
- Atualizado `google_script_fixes.md` com o erro da Drive API e a correcao aplicada.

## Arquivos da versao

- `BKP/cobrancas_v04.gs`
