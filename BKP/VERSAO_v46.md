# v46 - 2026-06-24

## Mudancas

- Corrigida a validacao da URL do Supabase em `salvarConfigSupabase()`.
- Adicionada `normalizarSupabaseUrl_()` para aceitar texto colado com aspas, caracteres invisiveis, barras finais ou caminho adicional.
- A configuracao agora salva apenas a origem `https://projeto.supabase.co`.
- Registrado o erro/correcao em `google_script_fixes.md`.

## Validacao

- Sintaxe do `cobrancas.gs` validada via Node.
- HTML servido validado com scripts inline e handlers compilados.
- Normalizacao testada com URL real no formato `https://toahxtgokhnoqdpteufz.supabase.co`.
