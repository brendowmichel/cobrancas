# Versao v32 — 2026-06-12

Refinamentos do redesign Material 3 (v31), com base no feedback de uso.

## Mudancas

1. **Bordas mais leves** — token `--md-outline-variant` de `#c9cbd4` para `#e7e8ef`. Deixa cards, divisores e tabela mais suaves, menos pesados.
2. **Ripple removido das tabelas** — o efeito de clique passou a valer apenas para botoes (`.btn-primary`, `.btn-secondary`, `.secondary`). Linhas de cliente mantem somente o realce de hover.
3. **Importacao so via Excel** — removidos o botao "Importar aba" e a funcao frontend `importarAbaPadrao()` do Web App. O menu do Google Sheets continua com o fallback tecnico (`Importar aba ativa` / `Importar aba Importacao`).
4. **Menu de importacao reduzido** — largura de 380px para 280px. Seletor de arquivo customizado: botao outlined "Escolher arquivo" + o nome do arquivo aparece logo **abaixo** do botao (em vez de ao lado), atualizado via `onchange`. Botao "Importar Excel" em largura total.

## Compatibilidade
- Logica de backend e fluxo de dados intactos. O input `arquivo-excel` continua existindo (oculto) e `importarArquivoExcel()` segue lendo `files[0]` normalmente.

## Verificacao
- `node --check`: sintaxe OK.
- Integridade: arquivo termina com `}`, `isBlankRow_` presente, sem bytes nulos (corrigido um null-padding residual no fim do arquivo).
