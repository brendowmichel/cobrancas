# v45 - 2026-06-24

## Mudancas

- Inicio da migracao da base do Google Sheets para Supabase/Postgres.
- Cabecalho do script atualizado para refletir GAS como interface/backend leve e Supabase como persistencia alvo.
- Adicionadas constantes `SUPABASE_PROPS` e `SUPABASE_TABLES`.
- Adicionado menu `Configurar Supabase` e `Testar Supabase`.
- Adicionada funcao `salvarConfigSupabase(url, apiKey)` para gravar credenciais em `PropertiesService`.
- Adicionada funcao `testarSupabase()` consultando a view `cobranca_dashboard_clientes`.
- Adicionados helpers internos:
  - `getSupabaseConfig_()`
  - `supabaseGet_()`
  - `supabasePost_()`
  - `supabasePatch_()`
  - `supabaseRequest_()`
  - `buildSupabaseUrl_()`
  - `buildQueryString_()`

## Observacao

- Dashboard, status e importacao ainda nao foram migrados nesta versao.
- Esta versao prepara apenas a camada de configuracao/conexao com o Supabase.

## Validacao

- Sintaxe do `cobrancas.gs` validada via Node.
- HTML servido validado com scripts inline e handlers compilados.
