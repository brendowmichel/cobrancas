# v20 - 2026-06-12

## Alterações

### Save fire-and-forget

- `salvarStatusCliente()` fecha o modal e exibe toast "Salvando..." imediatamente ao clicar em Salvar.
- O servidor é chamado em background (fire-and-forget).
- Toast "Status atualizado." aparece ao confirmar sucesso; toast de erro em vermelho se falhar.
- O dashboard é recarregado em background após confirmação de sucesso.

### Table UI — melhorias de layout

- Botão "Copiar resumo" renomeado para "Resumo" (evita quebra de linha na coluna de ações).
- Coluna de ações reduzida de 210px para 170px.
- Célula de nome reestruturada: substituído `<br>` por `<div class='cell-nome'>` (flex coluna), com classe `.cnpj-line` para o CNPJ (text-xs, gray-400, alinhado sob o nome sem <br>).
- Coluna "Status" no `<thead>` recebe `min-width: 170px` para manter estabilidade com conteúdo multiline (badge + data + obs).
- Adicionadas classes CSS `.cell-nome` e `.cnpj-line` ao bloco `@layer components`.
