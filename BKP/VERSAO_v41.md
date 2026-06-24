# VERSAO v41 - 2026-06-19

## Relatorios

- Botao `Relatorio` convertido em menu com opcoes `Resumido` e `Detalhado`.
- Relatorio resumido passou a aceitar multiplas paginas em A4 retrato.
- Fonte e espacamentos aumentados para melhorar leitura.
- Cabecalhos de tabela sao repetidos nas paginas seguintes.
- Observacoes completas, sem truncamento por quantidade de caracteres.
- CPF/CNPJ formatado no PDF.
- Indicadores separados em financeiro, status de contato e status de cadastro.
- Relatorio detalhado criado em A4 paisagem.
- Detalhado inclui todas as duplicatas agrupadas exibidas pela dashboard, com numero/RPS, parcela, vencimento, atraso, categoria, valor, recebido, saldo e status.
- Blocos detalhados repetem o cabecalho do cliente quando a tabela continua em outra pagina.

## Importacao

- Adicionada barra de progresso para leitura local do Excel.
- Adicionado estado indeterminado durante envio e processamento no Apps Script.
- Botao de importacao fica desabilitado durante o processo.
- Arquivo selecionado e descarregado apos sucesso.
- Mensagem `Arquivo importado com sucesso` permanece temporariamente e depois desaparece.
- Menu de importacao fecha automaticamente ao final.

## Interface

- Snackbar movido para o canto inferior direito.
- Snackbar remodelado em Material 3 Expressive com icone, titulo e botao de fechar.
- Fundo da pagina alterado para cinza muito claro.
- Cards brancos receberam borda mais sutil e elevacao.
- Menus de relatorio e importacao usam superficie branca elevada.

## Validacao

- Sintaxe do `cobrancas.gs` validada com Node.js.
- HTML servido validado com 2 scripts inline e 20 handlers.
- Relatorios resumido e detalhado testados com dados simulados.
- Confirmado que o resumido preserva observacoes completas.
- Confirmado que o detalhado inclui as duplicatas.
