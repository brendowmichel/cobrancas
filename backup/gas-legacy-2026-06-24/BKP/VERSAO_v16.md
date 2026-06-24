# v16 - 2026-06-11

## Alterações

### Redesign visual completo com Tailwind CSS v4

- CSS artesanal substituído por Tailwind CSS v4 via CDN (@tailwindcss/browser@4).
- Base branca neutra (white/gray-50), cores usadas exclusivamente para status e botões.
- KPI cards com borda sutil e shadow leve.
- Tabela principal com padding uniforme, hover suave e separadores finos.
- Seção de importação como `<details>` colapsável com ícone.
- Modal redesenhado com cantos arredondados e backdrop semitransparente.
- Toast com variantes coloridas por tipo (ok/err/warn).
- Paleta de status:
  - EM ABERTO: cinza neutro (badge-gray)
  - EM CONTATO: azul (badge-blue)
  - AGENDADO: violeta (badge-violet)
  - SUSPENSO: âmbar (cadastro-suspended)
  - CANCELADO: vermelho (cadastro-cancelled)
  - PROTESTADO: rosa escuro (cadastro-protested)
  - VENCIDO: vermelho (pill-vencido)
  - PARCIAL: laranja (pill-parcial)
  - RECEBIDO: verde (pill-recebido)
- Adicionados helpers JS: `statusContatoClass_()`, `cadastroTagClass_()`, `pillClass_()`.
- Toda a lógica de negócio e IDs de DOM preservados sem alteração.
