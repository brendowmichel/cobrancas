# v23 - 2026-06-12

## Alterações

### Tabela principal — somente clientes com 2+ duplicatas
- `inadimplentesView` agora filtra `duplicatas_vencidas > 1`. Clientes com apenas 1 duplicata em aberto não aparecem na tabela.
- Texto de rodapé da lista atualizado para "X cliente(s) com 2+ duplicatas vencidas."

### Header reestruturado
- Subtítulo unificado: "Atualizado em DD/MM/YYYY HH:MM:SS · X inadimplentes · Y duplicatas · Z dias de atraso máx."
- `formatarDataBR(str)` converte datas ISO para formato BR.
- Botão "Importar" adicionado ao lado do badge de versão; abre dropdown com o formulário de importação.
- Dropdown fecha automaticamente ao clicar fora (via `_closeImportOnOutside`).
- Accordion `<details>` de importação removido do corpo da página.

### KPIs e Gráficos unificados
- Grid de 4 cards de KPI + grid de 2 gráficos substituídos por um único grid 3-col: [Total vencido] [Status Contato] [Status Cadastro].
- Cards de Inadimplentes, Duplicatas vencidas e Maior atraso removidos (dados movidos para o subtítulo).

### Tabela de detalhe — espaçamento
- `width: 100%; table-layout: fixed` removidos de `.detail-table` → tabela auto-sized pelo conteúdo (`min-width: 600px`).
- Colgroup usa px fixos por coluna (105/90/110/80/auto/125); Categoria fica com o espaço natural do conteúdo.
