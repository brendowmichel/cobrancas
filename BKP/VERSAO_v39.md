# Versao v39 — 2026-06-12

Ajustes no relatorio PDF (`gerarRelatorioPdf`).

## 1) Uma pagina
Layout recompactado para caber em 1 pagina A4: fonte base 8px, paddings minimos,
`@page{size:A4 portrait;margin:16px}`, cabecalhos e cards menores. Nos volumes atuais
(~30-40 clientes) cabe em uma pagina.

## 2) Valores por status (faltavam)
Adicionados cards com o VALOR (R$) e a contagem de cada status, calculados como na dashboard:
- Contato (populacao 2+ dup, nao FINALIZADO, nao DESCONSIDERADO): EM ABERTO, EM CONTATO, AGENDADO.
- Cadastro (populacao 2+ dup, nao FINALIZADO; inclui desconsiderados): SUSPENSO, CANCELADO,
  PROTESTADO, PERMUTA, DESCONSIDERADO (so aparecem os com contagem > 0).

## 3) Cards de contagem removidos
Removidos os cards de Inadimplentes, Duplicatas vencidas, Maior atraso e Desconsiderados
(essas contagens ja aparecem no cabecalho de cada tabela: "N cliente(s) · R$ total").
Mantido o card "Total vencido". O espaco passou a ser usado pelos cards de valor por status.

## 4) Coerencia de rotulo
A tabela do relatorio antes chamada "FINALIZADOS" virou "PROTESTADOS" (mesma renomeacao da
dashboard na v38).

## Verificacao
- `node --check`: OK.
- Logica do relatorio testada com dados ficticios: cards de valor por status corretos
  (contato e cadastro como dimensoes independentes), moeda BRL, tabela "PROTESTADOS".
- 2847 linhas, sem bytes nulos, fecha com `}`. Patch via Python.

## Observacao
O conversor HTML->PDF do Apps Script nao garante paginacao por CSS; a unica-pagina e obtida
mantendo o conteudo compacto. Listas muito grandes (muitas dezenas de clientes) ainda podem
gerar 2 paginas.
