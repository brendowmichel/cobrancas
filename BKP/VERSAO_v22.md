# v22 - 2026-06-12

## Alterações

### Campo de busca — UX melhorada
- `type="search"` substituído por `type="text"` com wrapper posicionado.
- Ícone de lupa (SVG) no lado esquerdo.
- Botão X customizado (SVG) aparece só quando há texto — hover com bg cinza, sem borda, com `title`.
- `limparFiltro()` limpa o input, esconde o X e reaplicar filtro vazio.

### Gráficos de status (contato e cadastro)
- Dois cards no grid 2-col entre KPIs e o accordion de importação.
- Clientes com apenas 1 duplicata em aberto são excluídos dos gráficos.
- **STATUS DE CONTATO**: barra segmentada com EM ABERTO (cinza), EM CONTATO (azul), AGENDADO (violeta).
- **STATUS DE CADASTRO**: barra com SUSPENSO, CANCELADO, PROTESTADO, PERMUTA, DESCONSIDERADO — apenas categorias não-zero aparecem na legenda.
- `renderGraficos(inadimplentes)` é chamado em `renderDashboard` a cada reload.

### Tabela de detalhe — espaçamento balanceado
- `table-layout: fixed` adicionado a `.detail-table`.
- Colgroup substituído por porcentagens (11% Numero, 9% Status, 11% Vencimento, 9% Atraso, auto Categoria, 13% A receber).
- "A RECEBER" não fica mais isolado na borda direita.

### Status cell e observação — truncamento
- `.status-cell { max-width: 260px }` para não inflar a coluna com textos longos.
- `.status-note` alterado para `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px`.
- Atributo `title` adicionado ao span da observação — tooltip mostra o texto completo ao passar o mouse.
