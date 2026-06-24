# Instructions - Sistema de Gestao de Cobrancas

## Papel deste arquivo

Este arquivo e o cerebro do projeto. Toda decisao estrutural do sistema de cobrancas deve ser registrada aqui antes ou junto da alteracao no script.

O sistema sera feito em Google Apps Script como interface HTML/backend leve, usando Supabase/Postgres como base oficial de dados. A planilha original de cobrancas pode ser importada de Excel, mas a base final de controle nao deve depender de Google Sheets.

Em 2026-06-24, a versao Next.js/Vercel criada como teste foi movida para:

```text
backup/vercel-next-2026-06-24
```

A raiz do repositorio voltou a conter a versao Google Apps Script usada no momento.

## Versionamento

Ao fazer qualquer edicao no script `cobrancas.gs`, incremente a versao no cabecalho do arquivo:

```javascript
// SISTEMA DE GESTAO DE COBRANCAS - Apps Script v52
```

Tambem atualize a constante no topo do arquivo:

```javascript
const APP_VERSION = "v52";
```

Use a sequencia `v01`, `v02`, `v03`, etc.

Sempre que gerar uma nova versao do script:

1. Incremente `APP_VERSION` em `cobrancas.gs` — buscar por `APP_VERSION` e atualizar para o numero correto. OBRIGATORIO antes de salvar o arquivo.
2. Atualize o historico de versoes neste `instructions.md`.
3. Salve um snapshot do script em `BKP/` com o numero da versao.
4. Registre em `BKP/VERSAO_vXX.md` o que mudou naquela versao.

ATENCAO: `APP_VERSION` nao e atualizado automaticamente pelos patches Python. Sempre verificar e corrigir manualmente apos qualquer patch.

Arquivos de backup recomendados por versao:

- `BKP/cobrancas_vXX.gs`
- `BKP/VERSAO_vXX.md`

O arquivo `instructions.md` nao deve ser versionado nem copiado para `BKP/`. Ele e um arquivo vivo, incremental, e deve crescer junto com o projeto.

## Regras de edicao segura do cobrancas.gs

O `cobrancas.gs` e um arquivo grande (mais de 2000 linhas). Qualquer edicao direta com ferramentas de texto pode truncar o arquivo silenciosamente se o conteudo novo for grande demais ou se a ferramenta nao conseguir substituir com precisao.

Regras obrigatorias ao editar o `cobrancas.gs`:

1. Nunca usar Write para reescrever o arquivo inteiro. Sempre usar substituicoes cirurgicas (patch) via Python ou edit pontual.
2. Ao fazer substituicoes grandes (como reescrever `getWebAppHtml_()`), usar Python para: ler o arquivo completo, localizar a funcao pelos marcadores exatos, substituir apenas o trecho, e gravar o resultado de volta.
3. Apos qualquer escrita, verificar imediatamente que o arquivo nao foi truncado:
   - Conferir o numero de linhas (deve ser maior que 2000).
   - Confirmar que `function isBlankRow_` existe no final do arquivo.
   - Confirmar que o arquivo termina com `}` e nao com texto cortado.
4. Se o arquivo estiver truncado, reconstruir a partir do ultimo BKP integro usando o mesmo metodo de patch Python.
5. O backup deve ser salvo APOS a verificacao de integridade, nunca antes.

Verificacao minima de integridade (rodar em Python):

```python
with open('cobrancas.gs', 'r') as f:
    c = f.read()
assert 'function isBlankRow_' in c, 'TRUNCADO'
assert c.count('\n') > 2000, 'MUITO CURTO'
print('OK —', c.count('\n'), 'linhas')
```

## Base de conhecimento de fixes

Sempre que identificarmos um erro de programacao, implantacao, permissao ou comportamento inesperado no Google Apps Script, atualize o arquivo `google_script_fixes.md`.

Sempre que o erro vier do Supabase/Postgres/PostgREST/RLS/SQL Editor/importacao CSV/constraint/policy, atualize tambem ou preferencialmente o arquivo `supabase_fixes.md`.

Cada entrada deve conter:

- data;
- erro ou mensagem exibida;
- contexto em que aconteceu;
- causa provavel ou confirmada;
- correcao aplicada;
- prevencao para proximas versoes.

Exemplos de erros que devem entrar nessa base:

- funcao publica obrigatoria ausente, como `doGet()`;
- erro de permissao ou servico avancado nao habilitado;
- fluxo de interface que chama uma funcao incorreta;
- parser/importador que espera um formato diferente do arquivo real;
- regressao causada por mudanca de estrutura no script.

## Arquitetura Supabase

A partir da v45, o Google Sheets deixa de ser a base oficial do sistema. O GAS continua sendo usado para servir o HTML, receber uploads e executar regras de importacao, mas a persistencia principal deve ficar no Supabase/Postgres.

Fluxo alvo:

```text
HTML no Google Apps Script
        |
        | google.script.run
        v
Funcoes GAS
        |
        | UrlFetchApp / PostgREST
        v
Supabase/Postgres
```

As credenciais do Supabase nao devem ficar hardcoded no HTML nem em constantes visiveis do frontend. Devem ser salvas em `PropertiesService` com as chaves:

- `SUPABASE_URL`
- `SUPABASE_API_KEY`

Ao salvar a URL, o sistema deve normalizar o texto colado e armazenar apenas a origem no formato `https://projeto.supabase.co`. A normalizacao deve aceitar texto com ou sem protocolo, aspas, espacos, barras finais ou caminhos adicionais.

Funcoes de configuracao adicionadas na v45:

- `configurarSupabase()` - solicita URL e API key via menu do Apps Script.
- `salvarConfigSupabase(url, apiKey)` - salva URL/API key em `ScriptProperties`.
- `testarSupabase()` - consulta a view `cobranca_dashboard_clientes` e confirma se a conexao esta funcionando.
- `diagnosticarSupabase()` - compara contagens da view e de `cobranca_titulos`, registrando no Logger se ha dados abertos/vencidos.
- `supabaseGet_(resource, query)`
- `supabasePost_(resource, payload, query, prefer)`
- `supabasePatch_(resource, payload, query, prefer)`

Tabelas/views principais no Supabase:

- `cobranca_clientes`
- `cobranca_titulos`
- `cobranca_possiveis_duplicidades`
- `cobranca_logs_importacao`
- `cobranca_historico_status`
- `cobranca_dashboard_clientes`

Decisao de seguranca operacional a partir de 2026-06-24:

- O Supabase e acessado pelo Google Apps Script como backend do sistema, nao diretamente pelo HTML.
- Para reduzir atrito na fase atual, o RLS deve ficar desabilitado nas tabelas `cobranca_*` usadas pelo sistema.
- As permissoes passam a ser controladas pela chave do Supabase salva no `PropertiesService`.
- A chave do Supabase nunca deve ser exposta no HTML, em variaveis JavaScript do frontend ou hardcoded no `cobrancas.gs`.
- Se no futuro o frontend passar a acessar o Supabase diretamente, o RLS devera ser reativado e as policies deverao ser redesenhadas.

Na v48, o dashboard somente leitura passou a usar Supabase quando `SUPABASE_URL` e `SUPABASE_API_KEY` estiverem configurados. A funcao publica `getDashboardCobrancas()` usa:

- `cobranca_dashboard_clientes` para dados consolidados/status do cliente;
- `cobranca_titulos` para montar o detalhamento expansivel das duplicatas;
- fallback antigo em Google Sheets apenas se o Supabase ainda nao estiver configurado.

Na v49, a busca de titulos do dashboard passou a trazer titulos abertos do Supabase e aplicar filtros de `ativo_na_ultima_importacao` e vencimento dentro do GAS, reduzindo risco de retorno vazio por detalhe de filtro PostgREST. Tambem foi adicionado fallback visual pela view caso `cobranca_titulos` venha vazia.

Na v51, as escritas principais tambem passam a ser Supabase-first quando configurado:

- `atualizarStatusCliente()` grava em `cobranca_clientes` por `cnpj_cpf` e registra mudanca em `cobranca_historico_status`;
- `importarCobrancasDeValues_()` envia importacoes para `cobranca_titulos`, `cobranca_clientes`, `cobranca_logs_importacao` e `cobranca_possiveis_duplicidades`;
- titulos novos recebem `cliente_id` buscando o cliente sincronizado em `cobranca_clientes`;
- `getEstadoSistema()` considera o sistema preparado quando Supabase esta configurado;
- o menu do Sheets esconde opcoes legadas de preparar/importar abas quando Supabase esta configurado.

## Decisoes centrais

A planilha original de cobrancas nao possui ID unico confiavel. Portanto, o sistema nao deve depender de campos como linha da planilha, Numero, Boleto, Documento ou RPS como identificadores definitivos.

O sistema deve criar e manter seu proprio controle interno:

- `id_interno`
- `hash_identificacao`
- `hash_conteudo`

O `id_interno` e criado uma unica vez quando a cobranca entra na base principal.

A `hash_identificacao` serve para decidir se uma cobranca importada ja existe.

A `hash_conteudo` serve para detectar se uma cobranca existente teve alguma informacao alterada.

## Hash de identificacao

A composicao padrao da `hash_identificacao` e:

```text
CNPJ/CPF
+ Emissao
+ Vencimento
+ Parcela
+ Numero
+ Categoria
+ Valor da Conta
```

Essa combinacao foi escolhida porque a base pode conter cobrancas muito parecidas do mesmo cliente, inclusive com mesmo numero/RPS e vencimento, mas separadas por categoria e valor.

Campos que podem mudar ao longo do tempo nao devem entrar na hash de identificacao. Exemplos:

- Valor recebido
- Valor a receber
- Status da cobranca
- Observacao
- Responsavel
- Status de negociacao
- Dados complementares do cliente

Esses campos entram apenas na `hash_conteudo`.

## Hash de conteudo

A `hash_conteudo` deve representar o estado atual da cobranca importada. Ela deve incluir os campos visiveis de gestao que venham da origem, principalmente:

- cliente
- cnpj_cpf
- emissao
- vencimento
- categoria
- parcela
- numero
- boleto
- valor_conta
- valor_recebido
- valor_a_receber
- status_cobranca

Campos manuais de gestao, como `observacao`, `responsavel` e `status_negociacao`, devem ser preservados ao atualizar uma cobranca existente.

## Normalizacao antes das hashes

Antes de gerar qualquer hash, os dados devem ser normalizados:

- Remover espacos extras.
- Padronizar textos em maiusculo.
- Padronizar datas no formato `YYYY-MM-DD`.
- Remover mascara de CPF/CNPJ.
- Tratar `N/D`, `ND`, `N.A.`, `NA`, `-` e similares como vazio.
- Padronizar valores monetarios com duas casas decimais.
- Tratar numeros vindos do Excel como datas seriais quando o campo for data.
- Datas seriais do Excel devem ser convertidas diretamente para `YYYY-MM-DD` sem aplicar fuso horario local. Nao usar `formatDate_(new Date(serial...))`, pois em `America/Sao_Paulo` isso pode deslocar a data um dia para tras.

## Fluxo de importacao

1. Importar o arquivo Excel pelo botao `Importar Excel` do Web App.
2. Ler as linhas validas.
3. Normalizar os campos.
4. Gerar `hash_identificacao`.
5. Comparar com as hashes ja existentes na base principal.

Fluxo tecnico da importacao por Excel:

1. Usuario seleciona um arquivo `.xlsx` no Web App.
2. O frontend le o arquivo em base64.
3. O backend recebe o arquivo em `importarArquivoExcelUpload(payload)`.
4. O Apps Script le o `.xlsx` internamente como ZIP/XML usando `Utilities.unzip` e `XmlService`.
5. O sistema importa a primeira aba do arquivo.

Como `.xlsx` e internamente um arquivo ZIP, o blob usado em `Utilities.unzip` deve ser criado com ContentType `application/zip`. Se usar o MIME oficial de Excel nesse ponto, o Apps Script retorna erro de argumento invalido.

O formato `.xls` antigo nao e suportado no fluxo principal. Se o arquivo vier como `.xls`, salve como `.xlsx` antes de importar.

A importacao por uma aba ja existente (`Importacao` ou aba ativa) deve continuar disponivel apenas como alternativa tecnica ou fallback.

Se a hash nao existir:

- Adicionar como nova cobranca.
- Gerar novo `id_interno`.
- Registrar `data_primeira_importacao` e `data_ultima_importacao`.

Se a hash existir:

- Comparar `hash_conteudo`.
- Se `hash_conteudo` mudou, atualizar a cobranca existente.
- Se `hash_conteudo` nao mudou, manter como esta.
- Mesmo quando o conteudo nao mudar, atualizar os campos tecnicos `data_ultima_importacao`, `origem_arquivo` e `ativo_na_ultima_importacao`.

Ao atualizar uma cobranca existente:

- Atualizar campos vindos da importacao.
- Atualizar `hash_conteudo`.
- Atualizar `data_ultima_importacao`.
- Preservar campos manuais de gestao.

Ao final de uma importacao com registros validos, cobrancas antigas que nao aparecerem no arquivo atual devem receber `ativo_na_ultima_importacao = NAO`. Cobrancas encontradas no arquivo atual devem receber `SIM`.

## Duplicidades

O sistema deve manter uma area de possiveis duplicidades.

Se algum campo da hash de identificacao mudar na origem, especialmente valor, numero, categoria ou parcela, o sistema pode entender a cobranca como nova. Nesses casos, o sistema deve sinalizar registros parecidos para revisao manual em vez de juntar, apagar ou sobrescrever automaticamente.

Regra de similaridade a partir da v07:

- Mesmo CNPJ/CPF.
- Mesmo vencimento.
- E pelo menos um indicio forte adicional:
  - mesmo numero;
  - mesmo boleto;
  - mesma parcela e mesma categoria;
  - mesma categoria e mesmo valor;
  - mesma emissao combinada com mesma categoria ou mesmo valor.

Importante: mesma emissao nao basta para sinalizar duplicidade. Em contratos recorrentes, cobranças diferentes podem ter emissao parecida ou igual e vencimentos diferentes. Se o vencimento for diferente, o sistema nao deve sinalizar como possivel duplicidade.

Quando encontrar uma possivel duplicidade, registrar na aba `Possiveis Duplicidades`:

- data da deteccao
- tipo
- id_interno existente
- hash existente
- hash importada
- cliente
- cnpj_cpf
- emissao
- vencimento
- categoria
- parcela
- numero
- valor_conta
- observacao tecnica

## Estrutura das abas

### Base_Cobrancas

Colunas tecnicas, que podem ficar ocultas:

- `id_interno`
- `hash_identificacao`
- `hash_conteudo`
- `data_primeira_importacao`
- `data_ultima_importacao`
- `origem_arquivo`
- `ativo_na_ultima_importacao`

Colunas visiveis para gestao:

- `cliente`
- `cnpj_cpf`
- `emissao`
- `vencimento`
- `categoria`
- `parcela`
- `numero`
- `boleto`
- `valor_conta`
- `valor_recebido`
- `valor_a_receber`
- `status_cobranca`
- `observacao`
- `responsavel`
- `status_negociacao`

### Clientes

Aba de cadastro consolidado de clientes criada e atualizada automaticamente a cada importacao.

Chave principal:

- `cnpj_cpf`

Colunas:

- `cnpj_cpf`
- `cliente`
- `status_cobranca`
- `status_cadastro`
- `data_agendamento`
- `tipo_status`
- `responsavel`
- `observacao`
- `data_primeira_importacao`
- `data_ultima_importacao`
- `origem_arquivo`
- `ativo_na_ultima_importacao`
- `data_status_cadastro` (a partir da v37; data associada a PROTESTADO/DESCONSIDERADO, anexada ao final da aba)

A partir da v15, `status_cobranca` e `status_cadastro` sao campos independentes. Um cliente pode estar `EM ABERTO` (contato) e `SUSPENSO` (cadastro) ao mesmo tempo.

Ao importar, o sistema deve criar clientes novos com `status_cobranca = EM ABERTO`, `status_cadastro = (vazio)` e `tipo_status = CONTATO`.

Campos manuais do cadastro de clientes nao devem ser sobrescritos pela importacao:

- `status_cobranca`
- `status_cadastro`
- `responsavel`
- `observacao`

Status de contato (campo `status_cobranca`):

- `EM ABERTO`
- `EM CONTATO`
- `AGENDADO`

Status de cadastro (campo `status_cadastro`):

- (vazio — padrao, sem restricao de cadastro)
- `SUSPENSO`
- `CANCELADO`
- `PROTESTADO`

O campo `tipo_status` e sempre `CONTATO` a partir da v15. A tag de status de cadastro e exibida separadamente ao lado do nome do cliente na dashboard.

### Importacao

Aba opcional para colar ou carregar dados antes de rodar a importacao. Este nao e o fluxo principal do usuario final.

O script tambem pode importar de outra aba informada no menu ou por funcao.

### Possiveis Duplicidades

Aba de revisao manual para registros parecidos que nao devem ser unidos automaticamente.

### Log_Importacoes

Aba de auditoria com resumo de cada importacao:

- data_importacao
- versao
- origem_arquivo
- aba_origem
- registros_lidos
- ja_existiam
- atualizados
- novas_cobrancas
- possiveis_duplicidades
- ignorados
- observacao

## Resumo esperado ao final da importacao

Exemplo:

```text
195 registros lidos
180 ja existiam
10 atualizados
5 novas cobrancas adicionadas
2 possiveis duplicidades encontradas
```

## Arquivo de origem atual

O arquivo inicial encontrado na pasta do projeto e:

- `pivot.xlsx`

Aba encontrada no Excel:

- `Contas a Receber`

Cabecalhos reais identificados:

- `Minha Empresa (Nome Fantasia)`
- `Minha Empresa (Razao Social)`
- `Minha Empresa (CNPJ)`
- `Previsao`
- `CNPJ/CPF`
- `Razao Social`
- `Tags`
- `Emissao`
- `Vencimento`
- `Registro`
- `Categoria`
- `Conta Corrente`
- `Nota Fiscal`
- `Parcela`
- `Documento`
- `Numero`
- `Boleto`
- `Pedido de Venda`
- `Vendedor`
- `Projeto`
- `Origem`
- `Valor da Conta`
- `Valor PIS`
- `Valor COFINS`
- `Valor CSLL`
- `Valor IR`
- `Valor ISS`
- `Valor INSS`
- `Valor Liquido`
- `Recebido`
- `A Receber`

Mapeamento inicial para a base:

| Origem | Base |
|--------|------|
| `Razao Social` | `cliente` |
| `CNPJ/CPF` | `cnpj_cpf` |
| `Emissao` | `emissao` |
| `Vencimento` | `vencimento` |
| `Categoria` | `categoria` |
| `Parcela` | `parcela` |
| `Numero` | `numero` |
| `Boleto` | `boleto` |
| `Valor da Conta` | `valor_conta` |
| `Recebido` | `valor_recebido` |
| `A Receber` | `valor_a_receber` |

O `status_cobranca` deve ser calculado quando nao vier pronto na origem:

- `RECEBIDO`: valor a receber igual a zero.
- `PARCIAL`: valor recebido maior que zero e ainda existe valor a receber.
- `VENCIDO`: existe valor a receber e o vencimento e menor que a data atual.
- `EM ABERTO`: existe valor a receber e ainda nao venceu.

## Estrutura interna do `cobrancas.gs`

O projeto inicia em um unico arquivo para facilitar copiar e colar no Google Apps Script.

Blocos principais:

| Bloco | Responsabilidade |
|-------|------------------|
| Configuracao | Versao, nomes de abas, cabecalhos e aliases de colunas |
| Menu | Cria menu no Google Sheets |
| Web App | Entrada `doGet()`, dashboard de cobrança, upload de Excel e tela operacional quando o projeto for aberto como Web App |
| Setup | Cria e organiza abas tecnicas |
| Importacao | Le dados da origem, normaliza, compara e grava |
| Clientes | Mantem cadastro consolidado por CNPJ/CPF, com status de contato ou cadastro |
| Upload Excel | Recebe arquivo `.xlsx` em base64, le o XML interno e importa a primeira aba |
| Dashboard | Agrupa inadimplentes por cliente, calcula KPIs e exibe detalhe das duplicatas vencidas |
| Normalizacao | Datas, textos, documentos e valores |
| Hashes | Gera `hash_identificacao` e `hash_conteudo` |
| Duplicidades | Detecta e registra possiveis duplicidades |
| Logs | Registra resumo das importacoes |

Regra de manutencao: se a estrutura interna do `cobrancas.gs` mudar, atualize este arquivo na mesma alteracao.

Regra de leitura da base: ao ler a aba `Base_Cobrancas`, normalize novamente datas, documentos e valores antes de usar os dados no dashboard ou em comparacoes. O Google Sheets pode devolver datas como objeto `Date` e valores como numero, mesmo quando a importacao original gravou texto normalizado.

## Web App

O script deve manter a funcao publica `doGet()`. Sem ela, o Apps Script mostra o erro `Funcao de script nao encontrada: doGet` ao abrir a implantacao como Web App.

Na v45, `doGet()` entrega a tela principal como dashboard de cobranca com:

- versao atual do sistema;
- KPIs de total vencido, clientes inadimplentes, duplicatas vencidas e maior atraso;
- relacao de inadimplentes agrupada por cliente;
- colunas principais: nome, status, qtd., valor total, maior atraso e acoes;
- ordenacao clicavel por nome, duplicatas vencidas e valor total;
- clique no cliente para abrir as duplicatas vencidas em linhas expansíveis dentro da propria tabela;
- botoes de acao compactos por icone para copiar resumo e atualizar status;
- botao/acao de `Status` para atualizar status do cliente e observacao diretamente na aba `Clientes`;
- CPF/CNPJ formatado na visualizacao;
- status de contato com data de agendamento ao lado do chip e observacao em ate duas linhas com tooltip;
- quando o agendamento vence, o proprio chip `AGENDADO` vira `AG. VENCIDO`, sem criar tag adicional no nome do cliente;
- agrupamento visual de cobrancas do mesmo cliente com mesmo RPS/numero e vencimento;
- menu de importacao simples e recolhivel;
- resumo de importacao exibido em snackbar Material 3 no canto inferior direito.
- botao `Relatorio` com menu para gerar versao resumida ou detalhada.

A dashboard deve exibir apenas informacoes de cobranca vencida. Nao exibir cards de proximas acoes ou vencimentos futuros, porque o fluxo operacional dessa tela e focado em inadimplencia.

O fluxo principal de importacao do usuario final e o botao `Importar Excel`.

Diretriz visual a partir da v54:

- manter tema claro;
- usar `GT Walsheim Pro` quando disponivel e `Manrope` como fallback web;
- botoes pequenos, tags e chips devem ter formato pill com borda visivel;
- usar acento azul-esverdeado suave em botoes secundarios, menus e chips de contato;
- nao migrar a interface para modo escuro.

Na importacao pelo Web App:

- exibir progresso visual durante a leitura local do arquivo;
- usar progresso indeterminado durante o processamento no Apps Script;
- desabilitar o botao enquanto a importacao estiver em andamento;
- ao concluir, limpar o arquivo selecionado;
- mostrar `Arquivo importado com sucesso` por alguns segundos;
- limpar a mensagem e fechar o menu de importacao automaticamente;
- manter o resumo numerico da importacao no snackbar.

Na v04, a importacao de `.xlsx` nao depende do servico avancado `Drive API`. O arquivo e lido diretamente no Apps Script. A API do Drive deve ficar apenas como alternativa tecnica para funcoes legadas ou fallback.

Regra de UX: o botao `Preparar abas` nao deve aparecer no Web App quando as abas tecnicas ja existem com os cabecalhos esperados. Ele deve ser exibido apenas se alguma estrutura estiver faltando ou inconsistente. O menu da planilha pode manter a acao `Preparar abas` como manutencao tecnica.

## Dashboard de cobranca

A tela inicial deve ajudar a decidir quem cobrar primeiro.

Visao principal:

- KPIs executivos no topo.
- Lista de inadimplentes por cliente.
- Ordenacao inicial por maior valor vencido.
- Ordenacao manual por clique no cabecalho de nome, duplicatas vencidas e valor total.
- Detalhe das duplicatas vencidas ao clicar no cliente, abrindo linhas abaixo do proprio cliente na tabela.
- Coluna `Status`, exibindo status de contato em cima e observacao embaixo.
- Coluna final de acoes, com os botoes `Copiar resumo` e `Status`.
- Cobrancas do mesmo cliente com mesmo RPS/numero e mesmo vencimento devem aparecer como uma unica duplicata na dashboard, com valores somados.

Regras de status na dashboard:

- Status de cadastro aparecem como tag ao lado do nome do cliente.
- Status de contato aparecem na coluna `Status`.
- A observacao do cadastro aparece abaixo do status de contato.
- O botao `Status` permite alterar o status e escrever/atualizar a observacao.
- Novos clientes criados pela importacao comecam como `EM ABERTO`.

Detalhe esperado por cliente:

- lista compacta em tabela com numero, status, vencimento em `dd/mm/aaaa`, dias de atraso, categoria e valor a receber;
- sem repetir nome, documento, quantidade ou valor total, porque esses dados ja aparecem na linha principal.

Regra de agrupamento visual:

- A importacao e a `Base_Cobrancas` continuam preservando as linhas detalhadas por categoria/valor.
- Na dashboard e no resumo copiado, duplicatas do mesmo cliente com o mesmo `numero`/RPS e o mesmo `vencimento` devem ser agrupadas em uma unica linha.
- Os campos monetarios agrupados devem ser somados.
- Categorias diferentes devem aparecer juntas na linha agrupada, separadas por `+`.
- Quando uma linha representar mais de um item interno, exibir a indicacao de itens agrupados.

O detalhe visual nao deve usar cards grandes por duplicata. Use linhas de tabela compactas para facilitar leitura e comparacao. Na tela, nao exibir boleto nem parcela no detalhe expandido.

O botao `Copiar resumo` deve montar o texto completo com nome, documento, quantidade de duplicatas, valor total e detalhes das duplicatas. Essas informacoes nao precisam aparecer novamente dentro da area expandida.

O menu de importacao deve ser simples e secundario. Resultado de importacao deve aparecer em toast, por exemplo:

```text
195 registros lidos
195 ja existiam
0 atualizados
0 novas cobrancas adicionadas
0 possiveis duplicidades encontradas
1 ignorados
```

## Relatorios PDF

O botao `Relatorio` da dashboard deve abrir um menu com:

- `Resumido`
- `Detalhado`

O relatorio resumido:

- usa uma unica folha continua com largura de `210 mm`;
- calcula a altura conforme a quantidade de clientes, observacoes e linhas;
- nao usa rodape fixo nem contador de pagina;
- mostra CPF/CNPJ formatado;
- preserva a observacao completa, sem corte por quantidade de caracteres;
- separa indicadores financeiros, status de contato e status de cadastro;
- mostra as secoes `Inadimplentes`, `Desconsiderados` e `Protestados`.

O relatorio detalhado:

- usa uma unica folha continua com largura de `297 mm`;
- calcula a altura conforme a quantidade de clientes, observacoes e duplicatas;
- apresenta os mesmos indicadores e secoes do resumido;
- cria um bloco compacto para cada cliente;
- inclui status, documento, observacao, quantidade de duplicatas e valor total;
- detalha numero/RPS e parcela na mesma coluna;
- detalha vencimento e atraso na mesma coluna;
- mostra categoria, saldo a receber e status;
- usa as mesmas duplicatas agrupadas por RPS/vencimento exibidas na dashboard;
- evita cabecalhos e totais repetidos para ocupar menos espaco.

Regra tecnica: nao usar `counter(page)` ou rodape com `position: fixed` nos PDFs do Apps Script. O conversor pode exibir `Pagina 0`, sobrepor conteudo ou criar quebra adicional.

Ideias operacionais incorporadas ou planejadas:

- priorizar maiores valores vencidos;
- priorizar maior atraso;
- usar `observacao`, `responsavel` e `status_negociacao` para registrar contato e andamento;
- usar a aba `Clientes` para controlar status de contato e status de cadastro;
- copiar resumo do cliente para facilitar mensagem de cobranca.

## Como usar a v12

1. Crie ou abra uma planilha Google Sheets para ser a base do sistema.
2. Abra `Extensoes > Apps Script`.
3. Cole o conteudo de `cobrancas.gs`.
4. Salve e recarregue a planilha.
5. Publique ou atualize a implantacao como Web App.
6. Abra o Web App.
7. Selecione o arquivo `.xlsx` e clique em `Importar Excel`.

Como alternativa tecnica, ainda e possivel usar o menu `Cobrancas > Preparar abas`, `Cobrancas > Importar aba ativa`, `Cobrancas > Importar aba Importacao` ou rodar `importarCobrancasDaAba("Nome da Aba", "Nome do Arquivo")`.

Para importar um `.xlsx` diretamente por `fileId`, use `importarXlsxDoDrive(fileId)`. Essa funcao especifica ainda exige habilitar o servico avancado do Google Drive no Apps Script, mas nao e necessaria para o upload principal do Web App.

## Historico de versoes

| Versao | Data | Descricao |
|--------|------|-----------|
| v59 | 2026-06-24 | Simplificado o subtitulo do header da dashboard GAS: agora exibe apenas a data/hora da ultima atualizacao, enquanto totais de inadimplentes, duplicatas e maior atraso aparecem em tooltip ao passar o mouse ou focar o texto. |
| v58 | 2026-06-24 | Refinadas as tags de status de cadastro na dashboard GAS: tags ao lado do CNPJ/CPF ficaram menores, sem borda e com preenchimento suave para diferenciar visualmente dos status de contato. |
| v57 | 2026-06-24 | Ajustada a posicao das tags de status de cadastro na dashboard GAS: tags como `SUSPENSO`, `PERMUTA`, `PROTESTADO` e `DESCONSIDERADO` deixam de aparecer ao lado do nome do cliente e passam a ficar ao lado do CNPJ/CPF, liberando espaco para nomes longos. |
| v56 | 2026-06-24 | Ajustados elementos do header e ordenacao da dashboard GAS: icone principal trocado para Material Symbols `account_balance_wallet` com fundo no tom dos botoes, badge de versao movida para ao lado do titulo `Cobrancas`, e marcadores de ordenacao passam a usar `arrow_drop_up/down` preenchido do Material Design em vez de texto `^/v`. |
| v55 | 2026-06-24 | Refinamento visual da v54: removido o brilho/sombra interna branca dos chips/tags/pills, cards KPI e secoes principais ficam planos com borda limpa em vez de sombra, e legenda ativa dos graficos passa a usar borda/fundo suave em vez de sombra interna. |
| v54 | 2026-06-24 | Atualizada a aparencia da dashboard GAS: tipografia passa a priorizar `GT Walsheim Pro` com fallback `Manrope`, botoes e chips ganham visual pill com borda azul-esverdeada e tags de status/cadastro/duplicatas ficam com preenchimento claro e borda visivel, mantendo o tema claro. |
| v53 | 2026-06-24 | Ajuste visual da dashboard GAS: linhas com agendamento vencido agora mantem o estado vermelho ao passar o mouse ou abrir o detalhamento, escurecendo o vermelho em vez de cair no cinza do hover/selecionado generico. |
| v52 | 2026-06-24 | Corrigido payload Supabase de clientes: `status_cadastro` vazio agora e enviado como `null`, evitando violacao da constraint `chk_status_cadastro`. Datas condicionais vazias em atualizacao de status tambem passam a ir como `null`. Registrado em `google_script_fixes.md`. |
| v51 | 2026-06-24 | Escritas principais migradas para Supabase: salvar status atualiza `cobranca_clientes` e grava historico em `cobranca_historico_status`; importacao Excel passa a fazer upsert em `cobranca_titulos` e `cobranca_clientes`, registrar logs/duplicidades no Supabase e marcar ausentes como inativos. Menu/estado deixam de exigir preparo de abas quando Supabase esta configurado. |
| v50 | 2026-06-24 | Detalhamento do dashboard Supabase deixa de mostrar `0 duplicatas` quando a lista veio apenas do fallback da view. Clientes sem titulos retornados por `cobranca_titulos` agora exibem mensagem operacional indicando falta de SELECT/politica RLS ou necessidade de usar `service_role key`. |
| v49 | 2026-06-24 | Ajuste do dashboard Supabase: `cobranca_titulos` agora e buscada com menos filtros no PostgREST e os filtros de ativo/vencimento sao aplicados no GAS. Adicionado menu `Diagnosticar Supabase` para comparar contagens da view, titulos abertos e titulos vencidos. Adicionado fallback visual pela view caso a tabela de titulos venha vazia. |
| v48 | 2026-06-24 | Dashboard somente leitura migrado para Supabase: `getDashboardCobrancas()` agora usa `cobranca_dashboard_clientes` e `cobranca_titulos` quando Supabase esta configurado, preservando o formato esperado pelo frontend e mantendo fallback temporario para Sheets se nao houver configuracao. Detalhamento continua agrupando duplicatas por RPS/numero e vencimento. |
| v47 | 2026-06-24 | Reforcada a normalizacao da URL do Supabase: agora aceita URL com ou sem protocolo, `http`, caminhos extras, barras finais, aspas e espacos, salvando sempre como `https://projeto.supabase.co`. Mensagem de erro passa a mostrar uma previa sanitizada do valor recebido. |
| v46 | 2026-06-24 | Corrigida configuracao do Supabase: `salvarConfigSupabase()` agora normaliza a URL colada antes de validar, removendo caracteres invisiveis/aspas e extraindo `https://projeto.supabase.co`. Registrado em `google_script_fixes.md`. |
| v45 | 2026-06-24 | Inicio da migracao do GAS para Supabase: adicionadas constantes de tabelas, configuracao segura via `PropertiesService` (`SUPABASE_URL` e `SUPABASE_API_KEY`), menu `Configurar Supabase`/`Testar Supabase` e helpers `supabaseGet_`, `supabasePost_`, `supabasePatch_` usando `UrlFetchApp`/PostgREST. Dashboard ainda nao foi migrada; esta versao prepara a camada de conexao. |
| v44 | 2026-06-23 | Ajuste fino da dashboard: removidos os filtros rapidos abaixo da busca, mantendo filtro por nome e pelos cards superiores. Agendamentos vencidos agora alteram o proprio chip `AGENDADO` para `AG. VENCIDO` em vermelho, sem tag adicional no nome. Data do agendamento fica imediatamente ao lado do chip. |
| v43 | 2026-06-23 | Dashboard de cobranca mais compacta: linhas da tabela reduzidas, coluna `Duplicatas` renomeada para `Qtd.` e centralizada, largura das colunas padronizada, botoes `Resumo`/`Status` trocados por icones com tooltip, CPF/CNPJ formatado, status de contato com data ao lado do chip e observacao em ate duas linhas com tooltip. |
| v42 | 2026-06-19 | Relatorios convertidos para folha unica continua com altura calculada pelo conteudo. Removidos rodape fixo e contador de paginas que exibiam `Pagina 0` e vazavam para outra pagina. Detalhado condensado para cinco colunas, combinando numero/parcela e vencimento/atraso. |
| v41 | 2026-06-19 | Relatorios PDF divididos em `Resumido` e `Detalhado`, com menu no botao Relatorio, suporte a multiplas paginas, observacoes completas, documentos formatados e detalhamento de todas as duplicatas. Importacao ganhou progresso visual, limpeza automatica do arquivo e confirmacao temporaria. Snackbar movido para o canto inferior direito e remodelado em Material 3 Expressive. Fundo da pagina passou a cinza claro e cards brancos ganharam elevacao sutil. |
| v40 | 2026-06-17 | Corrigida conversao de datas seriais do Excel: vencimentos importados de `.xlsx` agora sao convertidos para `YYYY-MM-DD` usando componentes UTC, evitando que datas como `01/06/2026` aparecam como `31/05/2026` no fuso `America/Sao_Paulo`. |
| v39 | 2026-06-12 | Relatorio PDF refinado: cards de contagem (Inadimplentes, Duplicatas vencidas, Maior atraso, Desconsiderados) removidos — substituidos por cards de VALOR por status (Total vencido + EM ABERTO/EM CONTATO/AGENDADO e SUSPENSO/CANCELADO/PROTESTADO/PERMUTA/DESCONSIDERADO com contagem e R$). Layout muito mais compacto (fonte 8px, @page A4) para caber em uma pagina. Tabela "FINALIZADOS" do relatorio renomeada para "PROTESTADOS" (coerente com a dashboard). |
| v38 | 2026-06-12 | Secao de finalizados passa a usar clienteNomeHtml + statusClienteHtml (passa a exibir a tag de cadastro e a data de protesto/desconsideracao na coluna Status, como nas demais) e ganha somatorio no cabecalho. Rotulo "Finalizados" renomeado para "Protestados" (apenas o titulo; o filtro continua status_contato=FINALIZADO; IDs internos finalizados-* mantidos). Icones adicionados aos titulos das tabelas: Inadimplentes (warning) e Protestados (gavel), alinhando com Desconsiderados (do_not_disturb_on). |
| v37 | 2026-06-12 | (1) DESCONSIDERADO volta a aparecer no grafico STATUS DE CADASTRO (contagem propria via filtradoCadastro, sem afetar a contagem de contato); clicar nele rola ate a secao Desconsiderados. (2) Nova coluna `data_status_cadastro` na aba Clientes: PROTESTADO e DESCONSIDERADO agora tem data (igual AGENDADO). Modal mostra campo de data quando o status de cadastro e PROTESTADO/DESCONSIDERADO; data exibida na coluna Status. (3) Botao "Relatorio" no header gera PDF de uma pagina (Utilities HTML->PDF) com KPIs, e tabelas de Inadimplentes/Desconsiderados/Finalizados incluindo as observacoes; download via Blob no navegador. ATENCAO: nova coluna exige rodar "Preparar abas" (ou salvar um status) uma vez para migrar o cabecalho da aba Clientes. |
| v36 | 2026-06-12 | Grupo proprio para DESCONSIDERADO: clientes com status_cadastro DESCONSIDERADO saem da lista de inadimplentes (e da populacao dos graficos) e passam a aparecer numa secao separada "Desconsiderados" (tabela igual a de Finalizados), com contagem e total. toggleDetalheCliente generalizado para expandir o detalhe em qualquer tabela (corrige tambem Finalizados). Apenas frontend. |
| v35 | 2026-06-12 | CORRECAO CRITICA: dashboard ficava preso em "Carregando..." porque o onclick/onmouseover da legenda dos graficos (v33) usava aspas duplas escapadas `\"` dentro da template literal — a barra era consumida na avaliacao e o JS servido quebrava (Unexpected token 'this'). Reescrito com aspas simples + `&quot;` (padrao do projeto) e hover via CSS (.legend-chip). Validado no HTML SERVIDO (template literal avaliada) com new Function() em scripts e handlers. Ver google_script_fixes.md. |
| v34 | 2026-06-12 | Robustez: handler inline complexo do input de arquivo (onchange com this/&&/ternario) movido para a funcao nomeada mostrarNomeArquivo(). Reduz ruido no console e evita qualquer ambiguidade de parse em atributos inline. Verificado: scripts inline passam em node --check e os 16 handlers inline compilam com new Function(). A mensagem "Unexpected token 'this'" observada vem do wrapper de autorizacao do Apps Script (userCodeAppPanel?...AuthDialog=true), nao do codigo da aplicacao. |
| v33 | 2026-06-12 | Filtro por clique nas categorias dos graficos (STATUS DE CONTATO / STATUS DE CADASTRO): clicar numa categoria filtra a lista de inadimplentes por aquele status; clicar de novo limpa. Feedback visual na legenda (categoria ativa destacada em primary-container com anel; demais esmaecidas) e na barra; lista-info mostra o filtro ativo. Combina com o filtro de texto. NOTA: edicoes via ferramenta de texto truncaram o arquivo no meio (linha ~2561); restaurado do BKP/cobrancas_v32.gs e reaplicado via patch Python. |
| v32 | 2026-06-12 | Refinamentos do redesign M3: bordas mais leves (outline-variant #e7e8ef); removido o efeito ripple das linhas da tabela (mantido apenas em botoes); removidos o botao "Importar aba" e a funcao frontend importarAbaPadrao() (importacao agora so via Excel); menu de importacao reduzido (280px) com seletor de arquivo customizado (botao "Escolher arquivo" + nome do arquivo logo abaixo). Menu do Sheets mantem fallback tecnico de importar aba. |
| v31 | 2026-06-12 | Redesign visual e comportamental completo do Web App seguindo Material Design 3 / Material 3 Expressive (base branca, primaria Google Blue #0b57d0): tokens M3 em :root, tipografia Roboto Flex + icones Material Symbols, botoes pill (filled/tonal/outlined), cards de superficie tonal, chips de status, campos M3, dialog 28px, snackbar M3 e ripple/motion em botoes e linhas. IDs, classes e handlers preservados; apenas a camada de apresentacao foi alterada. |
| v19 | 2026-06-11 | Status DESCONSIDERADO adicionado ao cadastro (badge cinza). KPI "Total vencido" passa a exibir valor original riscado + valor ajustado em vermelho, excluindo clientes PERMUTA e DESCONSIDERADO. |
| v18 | 2026-06-11 | Exclusão física de registros pagos na importação: registros da Base_Cobrancas ausentes na nova importação são deletados da planilha (em vez de marcados como NAO). Toast exibe contagem de removidos. Aba Clientes preservada. |
| v17 | 2026-06-11 | Campo `data_agendamento` adicionado ao CLIENT_HEADERS e ao modal de status: aparece automaticamente ao selecionar AGENDADO, e exibido formatado (DD/MM/AAAA) na coluna de status da tabela. |
| v16 | 2026-06-11 | Redesign visual completo: CSS artesanal substituido por Tailwind CSS v4 via CDN; base branca neutra; cores exclusivas para status (EM ABERTO/EM CONTATO/AGENDADO/SUSPENSO/CANCELADO/PROTESTADO/VENCIDO/PARCIAL/RECEBIDO) e botoes; helpers JS statusContatoClass_(), cadastroTagClass_(), pillClass_() adicionados. |
| v15 | 2026-06-11 | Separados status de contato e status de cadastro em campos independentes: `status_cobranca` para EM ABERTO/EM CONTATO/AGENDADO e nova coluna `status_cadastro` para SUSPENSO/CANCELADO/PROTESTADO. Modal de status exibe dois seletores. Coluna ACOES da tabela principal corrigida para nao esprement os botoes. |
| v14 | 2026-06-11 | Dashboard passa a agrupar visualmente cobrancas do mesmo cliente com mesmo RPS/numero e vencimento, somando valores e exibindo categorias combinadas; a base continua preservando as linhas detalhadas. |
| v13 | 2026-06-11 | Dashboard passa a exibir status do cadastro de clientes: status de cadastro como tags ao lado do nome, status de contato e observacao em nova coluna `Status`, e botao `Status` para atualizar status/observacao diretamente na aba `Clientes`. |
| v12 | 2026-06-11 | Adicionada aba `Clientes` como cadastro consolidado por CNPJ/CPF com status de contato/cadastro; dashboard passa a ter coluna de acoes, botao `Copiar resumo` na linha principal, detalhe sem cabecalho redundante e ordenacao clicavel por nome, duplicatas vencidas e valor total. |
| v11 | 2026-06-11 | Detalhamento das duplicatas vencidas convertido de cards para tabela compacta; datas exibidas como `dd/mm/aaaa`; boleto e parcela removidos do detalhe visual, mantendo o botao de copiar resumo. |
| v10 | 2026-06-11 | Simplificada a dashboard para foco exclusivo em vencidos: removidos cards de proximas acoes e vencimentos futuros; detalhe do cliente passa a abrir como linhas expansíveis dentro da tabela de inadimplentes, mantendo o botao de copiar resumo. |
| v09 | 2026-06-11 | Corrigida leitura da base para o dashboard: datas e valores vindos do Google Sheets sao normalizados novamente, permitindo que vencidos aparecam corretamente mesmo quando a planilha devolve campos como `Date`/numero. |
| v08 | 2026-06-11 | Criada dashboard inicial de cobranca com KPIs, inadimplentes por cliente, detalhe de duplicatas ao clicar, proximos vencimentos, sugestoes operacionais e resumo de importacao em toast. |
| v07 | 2026-06-11 | Ajustada a regra de possiveis duplicidades: vencimento igual passa a ser obrigatorio; mesma emissao nao basta para sinalizar recorrencias como duplicadas. |
| v06 | 2026-06-11 | Corrigido ContentType do blob usado em `Utilities.unzip`: `.xlsx` passa a ser descompactado como `application/zip`, evitando erro de argumento invalido. |
| v05 | 2026-06-11 | Ajuste de UX: o botao `Preparar abas` no Web App passa a aparecer apenas quando a estrutura tecnica ainda nao estiver pronta; adicionada verificacao de estado das abas. |
| v04 | 2026-06-11 | Removida a dependencia da Drive API no upload principal de `.xlsx`; o Apps Script passa a ler o Excel internamente via ZIP/XML e importar a primeira aba sem conversao temporaria no Drive. |
| v03 | 2026-06-11 | Adicionado upload de arquivo Excel no Web App, conversao temporaria via Drive API, importacao direta da primeira aba e base de conhecimento `google_script_fixes.md` para registrar erros e correcoes. |
| v02 | 2026-06-11 | Adicionada entrada `doGet()` para abertura como Web App, com tela operacional minima para preparar abas e importar a aba `Importacao`. |
| v01 | 2026-06-11 | Criacao do cerebro do projeto, definicao de hashes internas, fluxo de importacao, abas da base, regras de duplicidade e primeira versao do script Apps Script. |
