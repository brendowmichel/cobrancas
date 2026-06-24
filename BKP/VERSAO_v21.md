# v21 - 2026-06-12

## Alterações

### Atualização visual imediata ao salvar status (optimistic update)

- `salvarStatusCliente()` atualiza o item em memória antes de chamar o servidor.
- Novo helper `atualizarLinhaClienteOtimista(item)` reescreve apenas as células de nome+tag e status da linha correspondente via `querySelector`.
- A linha reflete o novo status instantaneamente; `carregarDashboard()` sincroniza em background após confirmação.

### Tabela de detalhe ocupa toda a largura

- `.detail-table` alterado para `width: 100%`.
- `<colgroup>` com larguras fixas para colunas pequenas; Categoria toma o espaço restante.

### Filtro por nome acima da tabela de inadimplentes

- Input `#filtro-cliente` adicionado entre o cabeçalho do card e a tabela.
- Função `filtrarInadimplentes(termo)` filtra `inadimplentesView` pelo nome da empresa (case-insensitive, substring).
- `renderDashboard` reaplica o filtro atual ao recarregar, preservando a busca do usuário.
