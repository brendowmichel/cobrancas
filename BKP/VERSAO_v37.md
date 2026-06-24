# Versao v37 — 2026-06-12

## 1) DESCONSIDERADO volta ao grafico de cadastro
O grafico "STATUS DE CADASTRO" voltou a contar DESCONSIDERADO. A contagem de cadastro usa
uma populacao propria (`filtradoCadastro` = 2+ duplicatas, nao FINALIZADO) que inclui os
desconsiderados, sem alterar a contagem de "STATUS DE CONTATO" (que segue sem eles).
Clicar em DESCONSIDERADO no grafico rola a pagina ate a secao "Desconsiderados" (em vez de
filtrar a lista de inadimplentes para vazio).

## 2) Data para PROTESTADO e DESCONSIDERADO (como AGENDADO)
- Nova coluna `data_status_cadastro` na aba Clientes (anexada ao FINAL, para nao desalinhar
  dados existentes).
- No modal de status, ao escolher PROTESTADO ou DESCONSIDERADO aparece o campo
  "Data do protesto / desconsideracao".
- A data e exibida na coluna Status (ex.: "Protesto: 10/11/2025" / "Desconsid.: 05/01/2026"),
  preservada na importacao e salva por `atualizarStatusCliente`.
- ATENCAO: por ser coluna nova, rode "Preparar abas" (menu ou botao) ou salve um status uma vez
  para o cabecalho da aba Clientes ser migrado.

## 3) Botao "Relatorio" (PDF de uma pagina)
- Botao no header (icone picture_as_pdf).
- Backend `gerarRelatorioPdf()` monta um HTML compacto e converte para PDF via
  `Utilities.newBlob(html, "text/html").getAs("application/pdf")`.
- Conteudo: cabecalho + KPIs (total vencido, inadimplentes, duplicatas, maior atraso,
  desconsiderados) + tabelas de Inadimplentes, Desconsiderados e Finalizados, com nome, doc,
  status de contato (e data de agendamento), status de cadastro (e data), nº de duplicatas,
  valor e a OBSERVACAO de cada cliente.
- Download no navegador via Blob/objectURL (`baixarBase64_`).
- Layout compacto (fonte ~9px) para caber em uma pagina nos volumes atuais (~31 clientes).
  Volumes muito maiores podem gerar uma segunda pagina.

## Verificacao
- `node --check`: OK.
- HTML SERVIDO (template avaliada): scripts e handlers compilam (new Function).
- Logica do relatorio testada com dados ficticios (moeda BRL, datas, observacoes, 3 tabelas).
- 2837 linhas, sem bytes nulos, fecha com `}`. Patch via Python.

## Observacao tecnica
As ferramentas de edicao de texto deste ambiente vem anexando bytes nulos / truncando arquivos
grandes; por isso todas as mudancas no cobrancas.gs sao feitas por patch Python com strip de
`\x00` e verificacao de integridade.
