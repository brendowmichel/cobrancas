# v52 - 2026-06-24

## Mudancas

- Corrigido payload Supabase de `cobranca_clientes`.
- `status_cadastro` vazio agora e enviado como `null`, nao como string vazia.
- Adicionado helper `nullableStatusCadastro_()`.
- Atualizacao de status passa a enviar `data_agendamento` e `data_status_cadastro` vazias como `null`.
- `google_script_fixes.md` atualizado com o erro da constraint `chk_status_cadastro`.

## Validacao

- Sintaxe do `cobrancas.gs` validada via Node.
- HTML servido validado com scripts inline e handlers compilados.
