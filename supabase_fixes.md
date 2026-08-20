# Supabase Fixes - Base de Conhecimento

Este arquivo registra erros, permissoes, constraints, policies, importacoes CSV e ajustes de schema encontrados durante a migracao do sistema de cobrancas para Supabase/Postgres.

Use este arquivo sempre que um erro vier do Supabase, PostgREST, RLS, SQL Editor, CSV import ou constraints do banco.

## 2026-08-20 - Importacao concluia sem confirmar titulos ativos

### Sintoma

Um arquivo Excel continha quatro titulos vencidos do mesmo cliente, mas a dashboard exibia somente dois. No arquivo `pivot (2).xlsx`, para o CNPJ `06.922.577/0001-37`, foram confirmados os RPS `1133`, `1283`, `1389` e `1465`, todos com R$ 400,00 em aberto.

### Causa provavel

A importacao fazia o upsert e seguia para a inativacao dos titulos ausentes sem uma verificacao posterior de que cada hash lida estava realmente presente e ativa no Supabase. Isso permitia que uma falha parcial ou um estado antigo `ativo_na_ultima_importacao = false` passasse despercebido e ocultasse titulos na dashboard.

### Correcao aplicada

Na v60 do GAS, apos o upsert, cada lote de hashes importadas e:

- relido para identificar titulos inativos;
- reativado explicitamente;
- relido novamente para confirmar existencia e atividade.

Se algum hash nao for confirmado, a importacao e interrompida com erro claro e nao deve ser tratada como concluida.

### Prevencao

Toda importacao de snapshot deve validar a persistencia dos titulos antes de inativar registros que nao vieram no arquivo atual.

## 2026-08-20 - Dashboard ainda divergente apos reconciliacao de importacao

### Sintoma

Mesmo com a v60 ativa, a dashboard continuou mostrando dois titulos para o CNPJ `06.922.577/0001-37`, enquanto o arquivo de origem possui quatro RPS vencidos.

### Acao de diagnostico

Na v61 foi criada a funcao `diagnosticarTitulosClienteSupabase(documento)`. Ela consulta a tabela `cobranca_titulos` diretamente pelo CNPJ/CPF e registra:

- todos os titulos retornados;
- flag `ativo_na_ultima_importacao`;
- valor em aberto e vencimento;
- decisao de vencimento usada pela dashboard;
- arquivo e data da ultima importacao.

### Prevencao

Em divergencias entre Excel e dashboard, validar primeiro o estado bruto da tabela no Supabase. Nao presumir que a causa e agrupamento, importacao ou implantacao sem essa evidencia.

## 2026-08-20 - Filtro PostgREST grande demais para o Apps Script

### Erro

```text
Exception: Limite excedido: Comprimento do URL de UrlFetch.
```

### Causa

A reconciliacao pos-importacao enviava 100 hashes SHA-256 no filtro PostgREST `in.(...)`. Embora o PostgREST aceite a consulta, a URL ultrapassava o limite do `UrlFetchApp` antes de chegar ao Supabase.

### Correcao

Na v62, o lote foi reduzido para 15 hashes. Cada lote e consultado, reativado e confirmado separadamente.

## 2026-08-20 - Titulos existentes associados a campos antigos

### Sintoma

O arquivo foi lido com 213 registros e todos foram classificados como existentes. Mesmo assim, dois RPS de um cliente nao eram retornados pelo filtro de CNPJ no Supabase.

### Causa

Os registros possuiam `hash_identificacao` correspondente ao Excel, mas campos salvos de uma migracao anterior estavam divergentes. Como `hash_conteudo` tambem era igual, o fluxo anterior nao regravava as colunas de origem.

### Correcao

Na v63, o upsert de todo titulo identificado por hash passa a regravar os campos de origem normalizados e preservar somente os campos manuais. Isso repara CNPJ/CPF, numero, datas, categoria e valores sem criar novo titulo.

## 2026-06-24 - Decisao: desabilitar RLS nas tabelas do sistema

### Contexto

Durante a migracao para Supabase, varios fluxos do GAS foram bloqueados por RLS em sequencia:

- leitura da view/dashboard;
- upsert em `cobranca_clientes`;
- upsert em `cobranca_titulos`;
- insert em `cobranca_logs_importacao`;
- insert em `cobranca_historico_status`.

### Decisao

Como o Supabase e acessado pelo Google Apps Script como backend e nao diretamente pelo HTML, o RLS sera desabilitado nas tabelas `cobranca_*` do sistema durante esta fase.

### Correcao

```sql
alter table public.cobranca_clientes disable row level security;
alter table public.cobranca_titulos disable row level security;
alter table public.cobranca_possiveis_duplicidades disable row level security;
alter table public.cobranca_logs_importacao disable row level security;
alter table public.cobranca_historico_status disable row level security;
```

### Prevencao

A chave do Supabase deve continuar salva apenas no `PropertiesService` do Apps Script. Nao expor no HTML e nao hardcodar no `cobrancas.gs`.

Se algum dia o frontend acessar o Supabase diretamente, reativar RLS e redesenhar as policies.

## 2026-06-24 - CSV de clientes com linhas inteiras entre aspas

### Erro

```text
Too few fields: expected 13 fields but parsed 1
```

### Causa

Algumas linhas do CSV estavam com o registro inteiro entre aspas, por exemplo:

```csv
"34099631000121,MDL PECAS E SERVICOS AUTOMOTIVOS LTDA,..."
```

O importador lia a linha inteira como uma unica coluna.

### Correcao

Gerado CSV corrigido reprocessando essas linhas com parser CSV e validando que todas tinham 13 colunas.

Arquivo gerado na epoca:

```text
clientes_corrigido_supabase.csv
```

## 2026-06-24 - CSV de clientes com `cnpj_cpf` duplicado

### Erro

```text
duplicate key value violates unique constraint "cobranca_clientes_cnpj_cpf_key"
```

### Causa

A tabela `cobranca_clientes` tem `cnpj_cpf unique`. O CSV tinha documentos repetidos, inclusive:

```text
6922577000137
3958704379
642432000104
```

### Correcao

Gerado CSV deduplicado mantendo a linha com `data_ultima_importacao` mais recente por `cnpj_cpf`.

Arquivo gerado na epoca:

```text
clientes_deduplicado_supabase.csv
```

## 2026-06-24 - CSV com booleano `SIM`

### Erro

```text
invalid input syntax for type boolean: "SIM"
```

### Causa

Colunas booleanas do Postgres esperam `true/false`, mas o CSV exportado do Sheets continha `SIM/NAO`.

### Correcao

Converter antes de importar:

```text
SIM -> true
NAO -> false
```

No caso de `Base_Cobrancas`, foi gerado:

```text
base_cobrancas_supabase.csv
```

## 2026-06-24 - View sem permissao

### Erro

```text
permission denied for view cobranca_dashboard_clientes
```

### Causa

A API key usada pelo GAS nao tinha `select` na view.

### Correcao

```sql
grant usage on schema public to anon, authenticated;
grant select on public.cobranca_dashboard_clientes to anon, authenticated;
```

## 2026-06-24 - Tabela `cobranca_titulos` retornava zero linhas ao GAS

### Sintoma

`Diagnosticar Supabase` retornava:

```json
{
  "view_dashboard": 56,
  "titulos_abertos": 0,
  "titulos_vencidos_gas": 0
}
```

### Causa

A view tinha acesso aos dados, mas a API usada pelo GAS nao tinha permissao/policy suficiente para ler diretamente `cobranca_titulos`.

### Correcao

```sql
grant select on public.cobranca_titulos to anon, authenticated;

create policy "cobranca_titulos_select"
on public.cobranca_titulos
for select
to anon, authenticated
using (true);
```

Resultado esperado:

```json
{
  "titulos_abertos": 186,
  "titulos_vencidos_gas": 186
}
```

## 2026-06-24 - RLS bloqueando escrita em `cobranca_titulos`

### Erro

```text
new row violates row-level security policy for table "cobranca_titulos"
```

### Contexto

Durante a importacao Excel migrada para Supabase, o GAS tentou fazer upsert em `cobranca_titulos`.

### Causa

RLS ativo sem policy de `insert`/`update` suficiente para o role da API key usada pelo GAS. Para upsert, tambem e necessario `select`.

### Correcao

```sql
grant select, insert, update on public.cobranca_titulos to anon, authenticated;

create policy "cobranca_titulos_insert"
on public.cobranca_titulos
for insert
to anon, authenticated
with check (true);

create policy "cobranca_titulos_update"
on public.cobranca_titulos
for update
to anon, authenticated
using (true)
with check (true);
```

Se a policy ja existir, verificar em `pg_policies` ou recriar com `drop policy if exists`.

## 2026-06-24 - RLS bloqueando escrita em `cobranca_logs_importacao`

### Erro

```text
new row violates row-level security policy for table "cobranca_logs_importacao"
```

### Contexto

A importacao no Supabase conseguiu gravar os clientes/titulos, mas falhou ao salvar o resumo final da importacao.

### Causa

RLS ativo sem policy de `insert` para a tabela auxiliar `cobranca_logs_importacao`.

### Correcao

```sql
grant insert on public.cobranca_logs_importacao to anon, authenticated;

create policy "cobranca_logs_importacao_insert"
on public.cobranca_logs_importacao
for insert
to anon, authenticated
with check (true);
```

Se a policy ja existir, verificar em `pg_policies` ou recriar com `drop policy if exists`.

## 2026-06-24 - RLS bloqueando escrita em `cobranca_historico_status`

### Erro

```text
new row violates row-level security policy for table "cobranca_historico_status"
```

### Contexto

Ao editar status/observacao de um cliente, o GAS atualiza `cobranca_clientes` e depois tenta inserir um registro de auditoria em `cobranca_historico_status`.

### Causa

RLS ativo sem policy de `insert` para a tabela de historico.

### Correcao

```sql
grant insert on public.cobranca_historico_status to anon, authenticated;

create policy "cobranca_historico_status_insert"
on public.cobranca_historico_status
for insert
to anon, authenticated
with check (true);
```

Se a policy ja existir, verificar em `pg_policies` ou recriar com `drop policy if exists`.

## 2026-06-24 - RLS bloqueando escrita em `cobranca_clientes`

### Erro

```text
new row violates row-level security policy for table "cobranca_clientes"
```

### Causa

RLS ativo sem policy suficiente para `insert`/`update`, ou `upsert` sem permissao de `select`.

### Correcao recomendada

Para usar `anon/authenticated`:

```sql
grant select, insert, update on public.cobranca_clientes to anon, authenticated;

create policy "cobranca_clientes_select"
on public.cobranca_clientes
for select
to anon, authenticated
using (true);

create policy "cobranca_clientes_insert"
on public.cobranca_clientes
for insert
to anon, authenticated
with check (true);

create policy "cobranca_clientes_update"
on public.cobranca_clientes
for update
to anon, authenticated
using (true)
with check (true);
```

Para `upsert`, lembrar:

```text
SELECT + INSERT + UPDATE
```

## 2026-06-24 - Constraint `chk_status_cadastro`

### Erro

```text
new row for relation "cobranca_clientes" violates check constraint "chk_status_cadastro"
```

### Causa

`status_cadastro` aceita `NULL` ou um dos valores validos:

```text
SUSPENSO
CANCELADO
PROTESTADO
PERMUTA
DESCONSIDERADO
```

O GAS estava enviando string vazia `""`.

### Correcao

Na v52 do GAS:

- criado helper `nullableStatusCadastro_()`;
- payloads para Supabase enviam `null` quando nao ha status de cadastro;
- datas vazias condicionais tambem sao enviadas como `null`.

## Recomendacao geral de permissao

Enquanto o Supabase for acessado apenas pelo GAS como backend, a opcao mais simples e usar `service_role key` salva em `PropertiesService`.

Nunca:

- colocar `service_role key` no HTML;
- hardcodar chave no `cobrancas.gs`;
- expor a chave no frontend.
