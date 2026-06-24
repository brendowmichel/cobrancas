# v17 - 2026-06-11

## Alterações

### Campo de data ao agendar contato

- Nova coluna `data_agendamento` adicionada ao `CLIENT_HEADERS` (entre `status_cadastro` e `tipo_status`).
- `atualizarStatusCliente()` lê `payload.data_agendamento` e salva na planilha apenas quando `status_cobranca === "AGENDADO"`; caso contrário grava string vazia.
- `aplicarCadastroClienteAoGrupo_()` propaga `data_agendamento` do cadastro para `grupo.data_agendamento_cliente`.
- HTML – modal de status:
  - Nova `<div id="agendamento-row">` com `<input type="date" id="status-data-agendamento">`, oculta por padrão.
  - Campo aparece automaticamente ao selecionar **AGENDADO** no seletor de contato (via `onchange`) e é limpo ao trocar para outro status.
  - `abrirStatusCliente()` preenche e exibe/oculta o campo conforme o status atual do item.
  - Payload enviado ao servidor inclui `data_agendamento`.
- HTML – tabela:
  - Novo helper `formatDateBR(iso)` converte `YYYY-MM-DD` → `DD/MM/YYYY`.
  - `statusClienteHtml()` exibe a data formatada abaixo do badge **AGENDADO** na coluna de status da tabela.
