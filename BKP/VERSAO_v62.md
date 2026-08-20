# Versao v62 - 2026-08-20

## O que mudou

- Corrigido o limite de URL da reconciliacao de titulos importados.
- Filtros PostgREST por `hash_identificacao` agora usam lotes de 15 hashes SHA-256.
- Mantida a reativacao e confirmacao de todos os titulos do arquivo antes da conclusao da importacao.

## Problema corrigido

- A importacao de arquivos maiores falhava com `Limite excedido: Comprimento do URL de UrlFetch`.

## Arquivos alterados

- `cobrancas.gs`
- `instructions.md`
- `google_script_fixes.md`
- `supabase_fixes.md`

## Validacao

- Validar sintaxe JavaScript do Apps Script.
- Confirmar snapshot em `BKP/cobrancas_v62.gs`.
