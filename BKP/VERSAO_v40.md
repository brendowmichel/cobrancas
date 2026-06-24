# VERSAO v40 - 2026-06-17

## Mudancas

- Corrigida a conversao de datas seriais vindas de arquivos `.xlsx`.
- `normalizeDate_` agora usa `excelSerialDateToIso_(value)` para numeros de data do Excel.
- A conversao usa componentes UTC para gerar `YYYY-MM-DD`, sem aplicar o fuso horario local do Apps Script.
- Corrige vencimentos que apareciam um dia antes na dashboard, como `01/06/2026` virando `31/05/2026`.
- Registrado o fix em `google_script_fixes.md`.

## Observacao operacional

Registros ja importados com datas deslocadas precisam ser reimportados com a v40. Como a importacao atual remove da base as cobrancas que nao aparecem no arquivo novo, a reimportacao do `.xlsx` atualizado deve substituir os registros antigos com vencimento incorreto pelos registros com vencimento correto.

## Validacao

- Teste de conversao do serial Excel de `01/06/2026` confirmou saida `2026-06-01`.
- Sintaxe do `cobrancas.gs` validada com Node.js.
- Sintaxe dos scripts inline do Web App validada com Node.js.
