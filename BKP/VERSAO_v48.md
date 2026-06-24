# v48 - 2026-06-24

## Mudancas

- Dashboard somente leitura migrado para Supabase quando `SUPABASE_URL` e `SUPABASE_API_KEY` estiverem configurados.
- `getDashboardCobrancas()` agora decide a fonte:
  - Supabase configurado: usa `getDashboardCobrancasSupabase_()`;
  - Supabase ausente: usa fallback antigo `getDashboardCobrancasSheets_()`.
- Nova leitura em:
  - `cobranca_dashboard_clientes` para dados/status consolidados por cliente;
  - `cobranca_titulos` para detalhamento expansivel das duplicatas.
- Mantido o formato de resposta esperado pelo frontend atual.
- Mantido agrupamento visual de duplicatas por RPS/numero e vencimento.

## Observacao

- Atualizacao de status e importacao ainda nao foram migradas nesta versao.
- Para a dashboard via `anon key`, o Supabase precisa permitir `select` tambem em `cobranca_titulos`.

## Validacao

- Sintaxe do `cobrancas.gs` validada via Node.
- HTML servido validado com scripts inline e handlers compilados.
- Montagem do dashboard Supabase simulada localmente com mocks, validando agrupamento de RPS e formato de retorno.
