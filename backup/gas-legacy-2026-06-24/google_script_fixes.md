# Google Script Fixes - Base de Conhecimento

Este arquivo registra erros de programacao encontrados no Google Apps Script e a correcao aplicada. Ele deve ser atualizado sempre que um erro de script, implantacao, permissao ou comportamento inesperado for diagnosticado e corrigido.

## 2026-06-24 - Importacao Supabase violou constraint `chk_status_cadastro`

### Erro

```text
Error: Erro Supabase 400: {"code":"23514","message":"new row for relation \"cobranca_clientes\" violates check constraint \"chk_status_cadastro\""}
```

### Contexto

Durante a importacao Excel ja migrada para Supabase, o upsert em `cobranca_clientes` falhou.

### Causa

O banco aceita `status_cadastro` como `NULL` ou um dos valores validos (`SUSPENSO`, `CANCELADO`, `PROTESTADO`, `PERMUTA`, `DESCONSIDERADO`). O GAS estava enviando string vazia `""` quando o cliente nao tinha status de cadastro, e `""` viola a check constraint.

### Correcao aplicada

Na v52:

- adicionado `nullableStatusCadastro_()`;
- payloads Supabase de `cobranca_clientes` passam a enviar `null` quando nao houver status de cadastro;
- datas condicionais vazias (`data_agendamento`, `data_status_cadastro`) tambem passam a ir como `null` nos payloads Supabase de status.

### Prevencao

Para colunas Postgres com check constraints ou tipo `date`, usar `null` para ausencia de valor. Nao enviar string vazia em payloads do Supabase.

## 2026-06-24 - Dashboard Supabase carregava zerada sem erro visivel

### Erro

```text
Dashboard abriu com 0 inadimplentes, 0 duplicatas e R$ 0,00, mesmo apos importacao dos dados no Supabase.
```

### Contexto

Na v48, `getDashboardCobrancas()` passou a usar `cobranca_dashboard_clientes` e `cobranca_titulos`. A tela podia receber uma resposta valida, mas vazia, sem exibir erro no frontend.

### Causa provavel

A consulta de `cobranca_titulos` usava filtros PostgREST diretos para boolean/date (`ativo_na_ultima_importacao` e `vencimento`). Se esses filtros retornassem vazio por diferenca de formato, regra/permissao ou detalhe de API, a montagem ficava sem grupos, mesmo com a view tendo dados.

### Correcao aplicada

Na v49:

- a consulta de `cobranca_titulos` passou a buscar titulos com `valor_a_receber > 0`;
- filtros de ativo e vencimento passaram a ser aplicados dentro do GAS;
- foi adicionado fallback visual pela view `cobranca_dashboard_clientes` caso a tabela de titulos venha vazia;
- foi adicionada a funcao/menu `diagnosticarSupabase()` para comparar contagens da view, titulos abertos e titulos vencidos.

Na v50:

- quando o fallback da view for usado, o detalhe expandido deixa de mostrar `0 duplicatas`;
- a interface passa a exibir uma mensagem explicando que os titulos de `cobranca_titulos` nao foram retornados para o GAS, normalmente por falta de permissao `select`/politica RLS ou por nao usar `service_role key`.

### Prevencao

Ao migrar consultas do Sheets para Supabase, evitar falhas silenciosas: adicionar diagnosticos de contagem e, quando possivel, aplicar filtros sensiveis no GAS ate confirmar tipos/permissoes/RLS no Supabase.

## 2026-06-24 - Supabase retornou `permission denied for view cobranca_dashboard_clientes`

### Erro

```text
Error: Erro Supabase 401: {"code":"42501","details":null,"hint":null,"message":"permission denied for view cobranca_dashboard_clientes"}
```

### Contexto

Ao executar `testarSupabase()`, o GAS conseguiu chamar o endpoint REST do Supabase, mas a API key configurada nao tinha permissao de leitura na view `cobranca_dashboard_clientes`.

### Causa

No Supabase/Postgres, views e tabelas precisam ter permissao explicita para os roles usados pela API (`anon`, `authenticated`) ou o Apps Script precisa usar uma chave server-side com permissao suficiente. Como o GAS roda no servidor, a chave pode ficar em `PropertiesService`, mas nunca deve ser enviada ao HTML.

### Correcao recomendada

Para usar a `anon key`, liberar leitura da view:

```sql
grant usage on schema public to anon, authenticated;
grant select on public.cobranca_dashboard_clientes to anon, authenticated;
```

Alternativamente, usar a `service_role key` apenas no `PropertiesService` do Apps Script.

### Prevencao

Depois de criar novas views/tabelas no Supabase, validar permissao via API antes de migrar a funcao do GAS. Registrar quais roles podem acessar cada view.

## 2026-06-24 - URL valida do Supabase recusada na configuracao

### Erro

```text
Error: URL do Supabase invalida. Use o formato https://xxxx.supabase.co
```

### Contexto

Ao executar `Configurar Supabase`, uma Project URL valida, como `https://toahxtgokhnoqdpteufz.supabase.co`, foi recusada pelo validador de `salvarConfigSupabase()`.

### Causa

O validador original aceitava apenas a string limpa exatamente no formato final. Em prompts do Apps Script ou em texto copiado do navegador, a URL pode chegar com aspas, caracteres invisiveis, quebras/espacos especiais ou caminhos adicionais.

### Correcao aplicada

Na v46, `salvarConfigSupabase()` passou a usar `normalizarSupabaseUrl_()`, que:

- remove caracteres invisiveis comuns;
- remove aspas externas;
- extrai a primeira URL `https://...supabase.co` valida do texto colado;
- remove barras finais.

Na v47, a normalizacao foi reforcada para aceitar tambem:

- URL sem protocolo, como `toahxtgokhnoqdpteufz.supabase.co`;
- `http://...`, convertendo para `https://...`;
- caminhos extras, como `/rest/v1`;
- mensagem de erro com previa sanitizada do texto recebido.

### Prevencao

Validadores de configuracao manual devem normalizar entradas coladas pelo usuario antes de rejeitar. Para URL de Supabase, extrair a origem `https://projeto.supabase.co` e salvar apenas ela.

## 2026-06-19 - Rodape do PDF vazava e exibia `Pagina 0`

### Erro

```text
O rodape fixo aparecia sobre o conteudo ou isolado no inicio da pagina seguinte.
O contador era exibido como "Pagina 0".
```

### Contexto

Na v41, os relatorios resumido e detalhado usavam A4 com multiplas paginas, rodape em `position: fixed` e numero de pagina gerado por `counter(page)`.

### Causa

O conversor HTML para PDF usado pelo Google Apps Script nao oferece suporte confiavel ao contador CSS `counter(page)` nesse fluxo. O rodape fixo tambem participava de forma inconsistente da paginacao, podendo sobrepor linhas ou gerar uma area extra na pagina seguinte.

### Correcao aplicada

Na v42:

- removidos o rodape fixo e o contador CSS de paginas;
- os relatorios passaram a usar uma unica folha com altura calculada conforme clientes, observacoes e duplicatas;
- o resumido usa largura de `210 mm`;
- o detalhado usa largura de `297 mm`;
- a altura e limitada a `5000 mm`, respeitando o limite pratico de documentos PDF;
- o detalhamento foi condensado para cinco colunas.

### Prevencao

Nao usar `counter(page)` nem rodape `position: fixed` nos PDFs gerados por `Utilities.newBlob(html).getAs("application/pdf")`. Quando o objetivo for um relatorio continuo, usar tamanho de pagina CSS personalizado com altura calculada e conteudo em fluxo normal.

## 2026-06-17 - Vencimento importado do Excel aparecia um dia antes

### Erro

```text
Vencimento na planilha: 01/06/2026
Vencimento exibido na dashboard: 31/05/2026
```

### Contexto

Ao importar arquivo `.xlsx`, algumas datas de vencimento apareciam na dashboard com um dia a menos do que a data original da planilha. Exemplo observado: `RPS 1471` do cliente `GC IMOVEIS CONSULTORIA E NEGOCIOS LTDA`, com vencimento `01/06/2026` na planilha e `31/05/2026` no sistema.

### Causa

O Excel armazena datas como numero serial. A funcao `normalizeDate_` convertia esse serial para um objeto `Date` usando uma data em UTC e depois formatava esse objeto com o fuso horario do script (`America/Sao_Paulo`). Como meia-noite UTC ainda e o dia anterior em Sao Paulo, a data era gravada com um dia a menos.

### Correcao aplicada

Na v40:

- `normalizeDate_` deixou de converter serial numerico de Excel usando `formatDate_(new Date(...))`;
- criada a funcao `excelSerialDateToIso_(value)`;
- a conversao do serial passou a usar campos UTC (`getUTCFullYear`, `getUTCMonth`, `getUTCDate`) para gerar `YYYY-MM-DD` sem deslocamento por fuso horario.

### Prevencao

Datas seriais do Excel representam dias, nao instantes de tempo. Nunca converter serial de Excel para `Date` e depois formatar no fuso local. Para campos de data vindos de `.xlsx`, gerar `YYYY-MM-DD` diretamente pelos componentes UTC ou por aritmetica de calendario.

## 2026-06-12 - `\"` dentro da template literal quebra o JS servido (dashboard preso em "Carregando...")

### Erro

```text
Failed to execute 'write' on 'Document': Unexpected token 'this'
(em mae_html_user_...js; script principal do Web App nao executa)
```

### Contexto

O HTML do Web App e retornado por `getWebAppHtml_()` como UMA template literal (crases). Dentro de um bloco `<script>`, ao construir HTML de um handler inline usei aspas duplas escapadas com `\"` (ex.: `onclick=\"toggleFiltroCategoria('...')\"`). 

### Causa

A barra invertida de `\"` e consumida pela AVALIACAO da template literal. No codigo realmente servido, `\"` vira `"`, fechando a string JS no meio e gerando `Unexpected token 'this'`. Como o script principal nao carrega, o dashboard fica eternamente em "Carregando...".

Armadilha de validacao: `node --check` no TEXTO-FONTE passa (la o `\"` e uma aspa escapada valida). E preciso validar o texto SERVIDO (template literal ja avaliada).

### Correcao aplicada

Seguir o padrao do projeto: em strings JS que montam HTML, usar aspas SIMPLES no atributo e `&quot;` para as aspas internas (ex.: `onclick='toggleFiltroCategoria(&quot;...&quot;)'`). Nunca usar `\"` dentro da template literal. Hover movido de handler inline para CSS (`.legend-chip:hover`).

### Prevencao

Validar sempre o HTML SERVIDO: avaliar a template literal (com APP_VERSION) e rodar `new Function()` em cada `<script>` e em cada handler inline. Nunca usar `\"`/`\'` dentro da template literal do `getWebAppHtml_()`.

## 2026-06-12 - Arquivo truncado/corrompido por edicao de texto

### Erro

```text
SyntaxError: missing ) after argument list   (node --check, linha ~2561, dentro de normalizeDate_)
SyntaxError: Invalid or unexpected token     (bytes nulos no fim do arquivo)
```

### Contexto

Ao editar o `cobrancas.gs` (>2600 linhas) com a ferramenta de edicao de texto, o arquivo foi (a) truncado no meio de uma funcao e, em outra rodada, (b) preenchido com bytes nulos (`\x00`) ao final.

### Causa

Edicoes de texto diretas em arquivo grande podem truncar/corromper silenciosamente, exatamente como alertado em `instructions.md`.

### Correcao aplicada

Restaurado a partir do ultimo BKP integro (`BKP/cobrancas_v32.gs`) e as alteracoes reaplicadas via patch Python (substituicoes cirurgicas com `str.replace` e asserts). Verificacao com `node --check` + checagem de integridade (linhas, `isBlankRow_`, fecha com `}`, sem `\x00`).

### Prevencao

Para mudancas no `cobrancas.gs`, usar SEMPRE patch Python (ler arquivo inteiro, substituir trechos por marcadores exatos, gravar) e validar integridade antes de salvar o BKP. Evitar reescritas grandes pela ferramenta de texto.

## 2026-06-11 - Web App sem `doGet`

### Erro

```text
Funcao de script nao encontrada: doGet
```

### Contexto

O projeto foi aberto pela URL de uma implantacao como Web App, mas o arquivo `cobrancas.gs` ainda nao tinha a funcao publica `doGet()`.

No Google Apps Script, toda implantacao do tipo Web App precisa de uma entrada `doGet(e)` para responder a acessos via navegador.

### Causa

A v01 foi criada pensando no uso pelo menu da planilha (`onOpen`) e pelas funcoes chamadas manualmente, mas sem a entrada obrigatoria para Web App.

### Correcao aplicada

Na v02:

- foi adicionada a funcao publica `doGet()`;
- `doGet()` passou a retornar um `HtmlService.createHtmlOutput(...)`;
- foi criada uma tela operacional minima para preparar abas e importar a aba `Importacao`;
- o `instructions.md` passou a registrar que `doGet()` deve ser mantido.

### Prevencao

Sempre que o sistema for publicado ou testado como Web App, confirmar que existe uma funcao publica `doGet()` no arquivo principal.

## 2026-06-11 - Importacao exigia aba colada manualmente

### Erro

```text
Error: Nao foi possivel detectar o cabecalho da aba Importacao
```

### Contexto

A tela v02 oferecia a opcao `Importar aba Importacao`. Se a aba estivesse vazia, ou se o usuario esperasse enviar o Excel diretamente, a importacao falhava porque nao havia cabecalho para detectar.

### Causa

O fluxo implementado inicialmente aceitava dados ja colados em uma aba do Google Sheets. O fluxo desejado para o Web App era receber o arquivo Excel diretamente.

### Correcao aplicada

Na v03:

- foi adicionado um campo de upload de Excel no Web App;
- foi criada a funcao `importarArquivoExcelUpload(payload)`;
- o arquivo enviado e convertido temporariamente em Google Sheets usando o servico avancado Drive API;
- a primeira aba do arquivo convertido e importada pelo mesmo fluxo de normalizacao e hashes;
- a mensagem de erro da aba sem cabecalho foi melhorada para orientar o uso do botao `Importar Excel`.

### Prevencao

Quando o requisito for importar arquivo Excel, a interface deve receber o arquivo diretamente. A importacao por aba deve ficar apenas como alternativa tecnica ou fallback.

## 2026-06-11 - Upload de Excel dependia da Drive API

### Erro

```text
Error: Para importar Excel diretamente, ative o servico avancado do Google Drive no Apps Script. No editor: Servicos > + > Drive API > Adicionar. Tambem confirme o Google Cloud associado com a Drive API ativada.
```

### Contexto

A v03 recebeu o arquivo Excel pelo Web App, mas tentava converter o arquivo temporariamente em Google Sheets usando o servico avancado `Drive API`.

### Causa

O fluxo principal ficou dependente de uma configuracao extra no Apps Script. Isso cria atrito para o usuario e bloqueia a importacao se o servico avancado nao estiver habilitado.

### Correcao aplicada

Na v04:

- o upload principal passou a aceitar `.xlsx`;
- o arquivo e lido internamente com `Utilities.unzip`;
- os XMLs internos do Excel sao lidos com `XmlService`;
- a primeira aba e transformada em matriz de valores;
- a matriz e enviada ao mesmo fluxo de normalizacao, hashes e gravacao;
- a Drive API ficou apenas como fallback tecnico para funcoes legadas.

### Prevencao

Nao colocar servicos avancados como dependencia do fluxo principal quando o Apps Script conseguir resolver o caso com APIs nativas. Se uma dependencia externa for inevitavel, registrar essa exigencia antes no `instructions.md` e na interface.

## 2026-06-11 - `Utilities.unzip` exige `application/zip`

### Erro

```text
Exception: Argumento invalido: ContentType. Este argumento deveria ser do tipo: application/zip
```

### Contexto

A v04/v05 lia o `.xlsx` recebido no upload com `Utilities.unzip`, mas criava o blob com o MIME oficial de Excel:

```text
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

### Causa

Embora `.xlsx` seja internamente um arquivo ZIP, o Apps Script valida o `ContentType` do blob antes de executar `Utilities.unzip`. Para essa funcao, o tipo aceito precisa ser `application/zip`.

### Correcao aplicada

Na v06:

- o arquivo continua sendo validado como `.xlsx` pelo nome;
- o blob usado no unzip passou a ser criado com ContentType `application/zip`;
- o parser XML interno continua lendo `workbook.xml`, `sharedStrings.xml` e a primeira planilha do Excel.

### Prevencao

Sempre que usar `Utilities.unzip` no Apps Script, criar o blob com ContentType `application/zip`, mesmo que a extensao do arquivo original seja `.xlsx`.

## 2026-06-11 - Duplicidades falsas por vencimento diferente

### Erro

```text
Registros com vencimentos diferentes foram sinalizados como POSSIVEL_DUPLICIDADE.
```

### Contexto

Ao importar cobranças recorrentes do mesmo cliente, o sistema sinalizou registros como possiveis duplicidades mesmo quando os vencimentos eram claramente diferentes.

### Causa

A regra de similaridade inicial considerava:

```text
Mesmo CNPJ/CPF
+ mesmo vencimento OU mesma emissao
+ mesma categoria OU mesmo numero
```

Em contratos recorrentes, a mesma emissao ou uma emissao parecida pode aparecer em cobranças diferentes, com vencimentos diferentes. Nesse cenário, usar emissao como alternativa ao vencimento gerava falsos positivos.

### Correcao aplicada

Na v07:

- `vencimento` igual passou a ser obrigatorio para considerar possivel duplicidade;
- mesma emissao deixou de bastar para acionar duplicidade;
- depois de confirmar mesmo documento e mesmo vencimento, o sistema exige indicios adicionais, como mesmo numero, mesmo boleto, mesma parcela/categoria, mesma categoria/valor ou mesma emissao combinada com categoria/valor.

### Prevencao

Para cobranças recorrentes, nunca usar apenas emissao como criterio de proximidade entre cobranças. O vencimento e o primeiro filtro obrigatorio para duplicidade manual.

## 2026-06-11 - Dashboard vazio com dados na base

### Erro

```text
Dashboard mostrava R$ 0,00 e nenhum inadimplente, mesmo com dados na aba Base_Cobrancas.
```

### Contexto

A base ja possuia cobrancas importadas, mas a dashboard nao exibia inadimplentes nem valores vencidos.

### Causa

O dashboard lia a aba `Base_Cobrancas` e calculava atraso usando `parseIsoDate_`, que esperava datas em texto `YYYY-MM-DD`.

O Google Sheets pode devolver uma celula de data como objeto `Date` ou valores monetarios como numero, mesmo que a importacao tenha gravado dados normalizados. Quando o vencimento vinha como `Date`, o parser nao reconhecia a data e a cobranca nao entrava como vencida.

### Correcao aplicada

Na v09:

- `parseIsoDate_` passou a aceitar datas em formato `Date`, numero serial ou texto;
- a leitura da base (`carregarBase_`) passou a chamar `normalizarCobrancaBase_`;
- `normalizarCobrancaBase_` normaliza documento, emissao, vencimento, valores monetarios, status e ativo antes de usar os dados no dashboard.

### Prevencao

Toda leitura da base para dashboard, filtros ou comparacoes deve normalizar novamente campos sensiveis. Nunca assumir que o valor voltou do Google Sheets com o mesmo tipo usado na gravacao.

## 2026-06-11 - Uncaught qt ao salvar status com data de agendamento

### Erro

```text
459858322-mae_html_user_bin_i18n_mae_html_user__pt_br.js:302 Uncaught qt
```

### Contexto

Na v17, foi adicionado o campo `data_agendamento` ao cadastro de clientes. Ao salvar um cliente com status AGENDADO e uma data preenchida, o erro acima aparecia no console e o dashboard parava de carregar. O erro nao passava pelo `withFailureHandler` do `google.script.run`, indicando falha no nivel do framework GAS (nao do codigo do usuario).

### Causa

O campo `data_agendamento` era gravado no Google Sheets como string ISO (`"2026-06-15"`). O Sheets auto-converte strings nesse formato para objeto `Date` na celula. Ao ler a aba `Clientes` de volta via `carregarClientes_()`, o campo `data_agendamento` retornava como objeto `Date`.

Esse objeto `Date` ficava aninhado dentro do array `inadimplentes` retornado por `getDashboardCobrancas()`. Quando o GAS tentava serializar esse `Date` profundamente aninhado para enviar ao cliente via `google.script.run`, o serializador do framework falhava silenciosamente, lancando `Uncaught qt` em vez de passar pelo `withFailureHandler`.

### Correcao aplicada

Na v17c:

- `normalizarCliente_` passou a converter `data_agendamento` de `Date` → string ISO (`yyyy-MM-dd`) logo apos a leitura da planilha, usando `Utilities.formatDate` com o fuso horario do script. Isso garante que o campo seja sempre string antes de chegar em qualquer retorno de `google.script.run`.
- `formatDateBR` no cliente recebeu tratamento defensivo para objetos `Date` (fallback, caso algum escape da normalizacao do servidor).
- `sincronizarClientes_` foi corrigido para preservar `data_agendamento` durante importacoes (o campo estava sendo zerado a cada importacao de planilha).

### Prevencao

Nunca retornar campos de data diretamente lidos do Google Sheets via `google.script.run` sem normalizar para string primeiro. O Sheets converte strings ISO de data para objetos `Date` automaticamente. Objetos `Date` profundamente aninhados em arrays de retorno causam falha silenciosa no serializador GAS (`Uncaught qt`), nao chegando ao `withFailureHandler`. A correcao deve ser feita no servidor (converter `Date` → string ISO), nao no cliente.
