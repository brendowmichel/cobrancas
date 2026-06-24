# v50 - 2026-06-24

## Mudancas

- Detalhamento do dashboard Supabase deixa de exibir `0 duplicatas` quando os clientes vieram apenas do fallback da view.
- Grupos montados via fallback recebem `detalhe_indisponivel`.
- A expansao do cliente passa a exibir mensagem operacional explicando que `cobranca_titulos` nao foi retornada para o GAS.
- `google_script_fixes.md` atualizado com a causa provavel: permissao `select`/RLS ou necessidade de `service_role key`.

## Validacao

- Sintaxe do `cobrancas.gs` validada via Node.
- HTML servido validado com scripts inline e handlers compilados.
