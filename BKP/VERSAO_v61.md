# Versao v61 - 2026-08-20

## O que mudou

- Adicionada a funcao `diagnosticarTitulosClienteSupabase(documento)`.
- O diagnostico consulta os titulos brutos do cliente no Supabase e mostra quais entram no calculo da dashboard.
- O log inclui atividade, vencimento, valor, origem e data da ultima importacao de cada titulo.

## Objetivo

- Identificar com evidencias se uma divergencia vem da leitura do Excel, da gravacao no Supabase ou do filtro da dashboard.

## Arquivos alterados

- `cobrancas.gs`
- `instructions.md`
- `supabase_fixes.md`

## Validacao

- Validar sintaxe JavaScript do Apps Script.
- Confirmar snapshot em `BKP/cobrancas_v61.gs`.
