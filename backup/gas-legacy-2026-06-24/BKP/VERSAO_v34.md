# Versao v34 — 2026-06-12

## Contexto
Console do Web App exibiu:
- `An iframe which has both allow-scripts and allow-same-origin ... can escape its sandboxing` — aviso PADRAO e benigno do Apps Script (iframe do HtmlService). Nao e erro do nosso codigo.
- `userCodeAppPanel?...AuthDialog=true:244 Uncaught SyntaxError: Unexpected token 'this'` — originado no wrapper de autorizacao do proprio Apps Script (AuthDialog), nao no `cobrancas.gs`.

## Diagnostico
- Os dois blocos `<script>` inline passam em `node --check`.
- Os 16 handlers inline (`onclick`/`onchange`/`oninput`/`onmouseover`/`onmouseout`) compilam com `new Function()` sem erro.
- Os handlers gerados em runtime da legenda (`toggleFiltroCategoria(...)`, `this.style.background=...`) sao validos.
- `this` em handler inline ja era usado desde a v16 (busca, select de status) e sempre funcionou.

## Mudanca aplicada (robustez)
- O `onchange` do input de arquivo deixou de usar JS complexo inline (`(this.files&&this.files[0])?...`) e passou a chamar a funcao nomeada `mostrarNomeArquivo()`, que le o input por id e atualiza o nome exibido. Mais limpo e sem ambiguidade de parse em atributo.

## Verificacao
- `node --check`: OK. 2647 linhas, termina com `}`, `isBlankRow_` presente, sem bytes nulos.
- Patch aplicado via Python (sem ferramenta de edicao de texto, conforme regra de edicao segura).
