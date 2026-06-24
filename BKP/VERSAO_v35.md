# Versao v35 — 2026-06-12

## Correcao critica
O dashboard ficava preso em "Carregando..." e o console mostrava
`Failed to execute 'write' on 'Document': Unexpected token 'this'`.

### Causa
O filtro clicavel da legenda (v33) gerava handlers inline usando aspas duplas
escapadas `\"` DENTRO da template literal do `getWebAppHtml_()`. A barra invertida
e consumida quando a template literal e avaliada, entao o JS realmente servido virava
`onclick="toggleFiltroCategoria('...` (string fechada no lugar errado) -> SyntaxError.
Com o script principal quebrado, `carregarDashboard()` nunca rodava.

A validacao anterior falhou porque `node --check` rodou sobre o TEXTO-FONTE (onde `\"`
e valido), e nao sobre o texto SERVIDO (template literal ja avaliada).

### Correcao
- Legenda reescrita no padrao do projeto: atributo com aspas simples e `&quot;` para
  os argumentos do onclick (`onclick='toggleFiltroCategoria(&quot;campo&quot;,&quot;VALOR&quot;)'`).
- Efeito hover movido de handler inline para CSS: `.legend-chip:hover`.
- Nenhum `\"` dentro da template literal.

### Verificacao (no HTML SERVIDO)
- Template literal avaliada com APP_VERSION; `new Function()` em cada `<script>`: ambos OK.
- 16 handlers inline estaticos: OK.
- onclick da legenda decodifica para `toggleFiltroCategoria("status_contato","EM ABERTO")`: OK.
- `node --check` no .gs: OK. 2647 linhas, sem bytes nulos, fecha com `}`.

## Acao do usuario
Recolar `cobrancas.gs`, atualizar a implantacao e recarregar (Ctrl+Shift+R). O dashboard
deve carregar os dados normalmente e o filtro por categoria deve funcionar.
