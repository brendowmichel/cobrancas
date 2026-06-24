# Versao v38 — 2026-06-12

## Ajustes pedidos

1. **Data de protesto/desconsideracao visivel nas secoes**
   - A secao de finalizados usava `statusFinalizadoHtml` (so o badge), entao a data nao
     aparecia apos recarregar (so no update otimista ao salvar). Agora usa
     `clienteNomeHtml` (mostra a tag de cadastro ao lado do nome) + `statusClienteHtml`
     (mostra badge + data de agendamento + "Protesto:/Desconsid.: DD/MM/AAAA" + observacao).
   - Desconsiderados ja usava `statusClienteHtml`, entao a data ja aparecia ali.

2. **Renomear "Finalizados" -> "Protestados" (somente o rotulo)**
   - O titulo da secao virou "Protestados" e ganhou somatorio no cabecalho
     ("N cliente(s) · R$ total"), igual a Desconsiderados.
   - O filtro de conteudo permanece `status_contato === "FINALIZADO"` (decisao do usuario:
     so renomear). IDs internos (`finalizados-section/-body/-info`) mantidos.

3. **Icones nos titulos das tabelas**
   - Inadimplentes: `warning`
   - Protestados: `gavel` (mesmo simbolo do KPI Total protestado)
   - Desconsiderados: `do_not_disturb_on` (ja existia)
   Todos neutros (cor on-surface-variant), no mesmo padrao.

## Verificacao
- `node --check`: OK.
- HTML servido: scripts compilam; titulos com icone presentes; sem titulo "Finalizados".
- 2838 linhas, sem bytes nulos, fecha com `}`. Patch via Python.
