# Versao v60 - 2026-08-20

## O que mudou

- A importacao Supabase agora reconcilia os titulos que leu no Excel antes de finalizar.
- Cada hash importada e reativada explicitamente e confirmada por uma nova leitura no Supabase.
- Se algum titulo importado estiver ausente ou inativo, a importacao retorna erro em vez de concluir com uma dashboard incompleta.

## Problema corrigido

- Um Excel com quatro RPS vencidos para o mesmo cliente podia resultar em apenas dois titulos ativos na dashboard, sem alerta de inconsistencia.

## Arquivos alterados

- `cobrancas.gs`
- `instructions.md`
- `supabase_fixes.md`

## Validacao

- Validar sintaxe JavaScript do Apps Script.
- Confirmar snapshot em `BKP/cobrancas_v60.gs`.
