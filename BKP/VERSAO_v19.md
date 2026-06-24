# v19 - 2026-06-11

## Alterações

### Status de cadastro: DESCONSIDERADO

- `DESCONSIDERADO` adicionado a `STATUS_CADASTRO_CLIENTE`.
- Badge cinza neutro (`cadastro-desconsiderado`) para identificação visual na tabela.
- Opção adicionada ao seletor do modal de status.

### KPI Total vencido com valor ajustado

- `getDashboardCobrancas` retorna agora dois totais:
  - `total_vencido`: soma de todos os clientes inadimplentes (original).
  - `total_vencido_ajustado`: exclui clientes com `status_cadastro` = `PERMUTA` ou `DESCONSIDERADO`.
- O card "Total vencido" exibe:
  - Valor original riscado (cinza) acima, quando há diferença.
  - Valor ajustado em vermelho abaixo.
  - Quando não há diferença (nenhum PERMUTA/DESCONSIDERADO), exibe apenas o total normal sem riscado.
