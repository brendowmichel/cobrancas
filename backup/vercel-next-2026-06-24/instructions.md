# Instructions - Sistema de Cobrancas Next.js

## Papel deste arquivo

Este arquivo e o cerebro vivo da nova fase do projeto.

O sistema passa a ser uma aplicacao Next.js publicada pela Vercel, usando Supabase/Postgres como base oficial.

O projeto legado em Google Apps Script foi movido para:

```text
backup/gas-legacy-2026-06-24
```

## Arquitetura atual

```text
Navegador
  |
  v
Next.js na Vercel
  |
  | rotas /api/*
  v
Supabase/Postgres
```

O frontend nao deve acessar diretamente a chave sensivel do Supabase.

As credenciais devem ficar em variaveis de ambiente:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Tabelas principais

- `cobranca_clientes`
- `cobranca_titulos`
- `cobranca_possiveis_duplicidades`
- `cobranca_logs_importacao`
- `cobranca_historico_status`
- `cobranca_dashboard_clientes`

## Regras de seguranca

- Nunca commitar `.env` ou `.env.local`.
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- Toda escrita deve passar por rota server-side em `app/api`.
- O RLS foi desabilitado nas tabelas `cobranca_*` enquanto o acesso ao Supabase for intermediado pelo backend do sistema.

## Funcionalidades da primeira versao Next.js

- Dashboard de inadimplentes.
- KPIs de total vencido, total protestado, quantidade de clientes, duplicatas e maior atraso.
- Busca por nome/documento/status.
- Ordenacao por nome, quantidade e valor total.
- Detalhe expansivel das duplicatas por cliente.
- Copiar resumo.
- Atualizacao de status do cliente.
- Importacao de Excel para Supabase.

## Backup do legado

O backup contem:

- `cobrancas.gs`
- historico `BKP/`
- `google_script_fixes.md`
- `supabase_fixes.md`
- arquivos CSV/XLSX locais usados na migracao
- instrucoes antigas do GAS

Nao apagar esse backup ate a versao Next.js estar validada em producao.

