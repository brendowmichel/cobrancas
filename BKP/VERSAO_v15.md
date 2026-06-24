# v15 - 2026-06-11

## Alterações

### Fix: layout da coluna AÇÕES
- Adicionado `width: 210px; min-width: 210px` na coluna de ações da tabela principal.
- Removido `flex-wrap: wrap` do `.action-stack`, impedindo que os botões "Copiar resumo" e "Status" quebrem linha.

### Fix: modal de status com dois seletores independentes
- Adicionada coluna `status_cadastro` ao `CLIENT_HEADERS` (posição após `status_cobranca`).
- `status_cobranca` passa a armazenar exclusivamente status de contato: EM ABERTO, EM CONTATO, AGENDADO.
- `status_cadastro` armazena exclusivamente status de cadastro: SUSPENSO, CANCELADO, PROTESTADO (ou vazio).
- Modal "Atualizar status" agora exibe dois seletores separados: "Status de contato" e "Status de cadastro".
- Um cliente pode estar EM ABERTO (contato) e SUSPENSO (cadastro) simultaneamente.
- Adicionada função `normalizarStatusCadastro_()`.
- `normalizarStatusCliente_()` passa a aceitar apenas status de contato.
- `aplicarCadastroClienteAoGrupo_()`, `sincronizarClientes_()` e `atualizarStatusCliente()` atualizados para ler e gravar os dois campos independentemente.
- Campos manuais `status_cobranca`, `status_cadastro` e `observacao` preservados em todas as sincronizações de importação.
