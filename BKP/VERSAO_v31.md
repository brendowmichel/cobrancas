# Versao v31 — 2026-06-12

## Resumo

Redesign visual e comportamental completo do Web App seguindo o **Material Design 3 / Material 3 Expressive** (o mais recente do Google, 2025), mantendo a **base branca**.

## O que mudou

### Sistema de design (tokens M3)
- Adicionado conjunto de tokens M3 em `:root` (esquema claro, base branca, primaria **Google Blue `#0b57d0`**): primary/secondary/tertiary, containers, error/success/warning, superficies tonais (`surface-container-*`), outline, inverse-surface e elevacoes (`--md-shadow-1..3`).
- Tipografia trocada para **Roboto Flex** (com fallback Roboto) e icones **Material Symbols Rounded** carregados via Google Fonts (`.md-icon`).

### Componentes
- **Botoes**: estilo M3 pill (cantos totalmente arredondados). `.btn-primary` = filled (primaria), `.btn-secondary`/`.secondary` = tonal (secondary-container), `.secondary.small` = outlined compacto. State layer no hover.
- **Cards** (`.md-card`): superficie branca com outline-variant, cantos 16px e elevacao suave no hover (`.md-card-hover`).
- **Chips de status**: `status-badge`, `cadastro-tag` e `pill` redesenhados como chips M3 tonais (container + on-container), mantendo a semantica de cores por status.
- **Campos** (`.md-field`): inputs/selects/textarea estilo M3, cantos 12px, foco com anel na primaria.
- **Dialog** (modal de status): superficie `surface-container-high`, cantos 28px, scrim 32%, animacao de entrada.
- **Snackbar** (toast): estilo M3 escuro (inverse-surface) centralizado embaixo, com indicador colorido por tipo (ok/err/warn).
- **Header**: top app bar com icone em "container" arredondado.

### Comportamento (motion M3)
- **Ripple** em botoes e linhas de cliente (JS delegado + `MutationObserver` para reanexar apos renders dinamicos).
- Animacao de **expansao** do detalhe do cliente (`md-expand`), de **dialog** e de **snackbar**.

## Compatibilidade
- Todos os IDs, classes referenciadas pelo JS, handlers `onclick`/`onchange` e o fluxo de dados foram **preservados**. Nenhuma funcao de backend ou logica de dashboard foi alterada — apenas a camada de apresentacao (`getWebAppHtml_`).
- Tailwind CSS v4 (browser CDN) mantido.

## Verificacao
- `node --check` no script: sintaxe OK.
- Integridade: 2627 linhas, `isBlankRow_` presente, arquivo termina com `}`.
- Tags HTML balanceadas; todas as classes usadas pelo JS continuam definidas no CSS.

## Como aplicar
1. Cole o conteudo de `cobrancas.gs` no Apps Script.
2. Salve e atualize a implantacao como Web App.
3. Abra o Web App (Ctrl+Shift+R para limpar cache de CSS/fonte se necessario).
