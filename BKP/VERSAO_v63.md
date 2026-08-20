# Versao v63 - 2026-08-20

## O que mudou

- Titulos existentes agora recebem novamente todos os campos vindos do Excel a cada importacao.
- Divergencias entre os campos normalizados e a origem tambem contam como atualizacao, mesmo quando a hash de conteudo for igual.
- A hash de identificacao e confirmada no payload de upsert.

## Problema corrigido

- Titulos migrados com hash correta, mas CNPJ/CPF ou outro campo antigo, podiam ficar fora da dashboard do cliente e ainda aparecer como "ja existiam" na importacao.

## Preservacao de dados

- `observacao`, `responsavel` e `status_negociacao` continuam preservados.

## Arquivos alterados

- `cobrancas.gs`
- `instructions.md`
- `google_script_fixes.md`
- `supabase_fixes.md`

## Validacao

- Validar sintaxe JavaScript do Apps Script.
- Confirmar snapshot em `BKP/cobrancas_v63.gs`.
