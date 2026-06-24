# v47 - 2026-06-24

## Mudancas

- Reforcada a normalizacao da URL do Supabase.
- `normalizarSupabaseUrl_()` agora aceita URL com ou sem protocolo, `http`, caminhos extras, barras finais, aspas e espacos.
- A URL e sempre salva no formato `https://projeto.supabase.co`.
- Mensagem de erro passa a exibir uma previa sanitizada do valor recebido, facilitando diagnostico.
- `google_script_fixes.md` atualizado com a segunda protecao do fix.

## Validacao

- Sintaxe do `cobrancas.gs` validada via Node.
- HTML servido validado com scripts inline e handlers compilados.
- Normalizacao testada com URL real em multiplos formatos.
