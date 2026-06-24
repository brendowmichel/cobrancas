# v49 - 2026-06-24

## Mudancas

- Ajustada a leitura Supabase do dashboard para reduzir retornos vazios silenciosos.
- `cobranca_titulos` agora e buscada com filtro apenas em `valor_a_receber > 0`.
- Filtros de `ativo_na_ultima_importacao` e vencimento passaram a ser aplicados dentro do GAS.
- Adicionado fallback visual pela view `cobranca_dashboard_clientes` caso a tabela de titulos venha vazia.
- Adicionado menu/função `diagnosticarSupabase()`.
- `google_script_fixes.md` atualizado com o caso da dashboard zerada sem erro visivel.

## Validacao

- Sintaxe do `cobrancas.gs` validada via Node.
- HTML servido validado com scripts inline e handlers compilados.
- Montagem do dashboard Supabase simulada localmente com mocks.
