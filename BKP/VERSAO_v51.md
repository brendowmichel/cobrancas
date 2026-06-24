# v51 - 2026-06-24

## Mudancas

- Escritas principais migradas para Supabase quando configurado.
- `atualizarStatusCliente()` deixa de usar a aba `Clientes` e passa a:
  - upsert em `cobranca_clientes` por `cnpj_cpf`;
  - inserir historico em `cobranca_historico_status`.
- Importacao Excel via `importarCobrancasDeValues_()` passa a:
  - ler/normalizar o arquivo no GAS;
  - gerar `hash_identificacao` e `hash_conteudo`;
  - fazer upsert em `cobranca_titulos`;
  - sincronizar `cobranca_clientes`;
  - gravar `cobranca_logs_importacao`;
  - gravar `cobranca_possiveis_duplicidades`;
  - marcar titulos ausentes da importacao como `ativo_na_ultima_importacao=false`.
- Titulos novos recebem `cliente_id` com base em `cobranca_clientes`.
- `getEstadoSistema()` considera Supabase configurado como sistema preparado.
- Menu do Sheets oculta opcoes legadas de preparar/importar abas quando Supabase esta configurado.

## Observacao

- Funcoes antigas de Sheets permanecem no arquivo como fallback tecnico quando Supabase nao estiver configurado.
- Supabase precisa de permissoes de `select/insert/update` nas tabelas usadas, ou chave `service_role` salva em `PropertiesService`.

## Validacao

- Sintaxe do `cobrancas.gs` validada via Node.
- HTML servido validado com scripts inline e handlers compilados.
