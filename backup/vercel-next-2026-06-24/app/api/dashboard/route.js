import { NextResponse } from "next/server";
import { groupTitles } from "@/lib/cobrancas";
import { TABLES, supabaseGet } from "@/lib/supabase";
import { toNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [clientesDashboard, titulos] = await Promise.all([
      supabaseGet(TABLES.DASHBOARD, {
        select: [
          "cliente_id",
          "cnpj_cpf",
          "cliente",
          "status_contato",
          "status_cadastro",
          "data_agendamento",
          "data_status_cadastro",
          "responsavel",
          "observacao",
          "duplicatas_vencidas",
          "valor_total",
          "maior_atraso"
        ].join(","),
        order: "valor_total.desc",
        limit: "5000"
      }),
      supabaseGet(TABLES.TITULOS, {
        select: [
          "id_interno",
          "cliente",
          "cnpj_cpf",
          "emissao",
          "vencimento",
          "categoria",
          "parcela",
          "numero",
          "boleto",
          "valor_conta",
          "valor_recebido",
          "valor_a_receber",
          "status_cobranca",
          "ativo_na_ultima_importacao"
        ].join(","),
        valor_a_receber: "gt.0",
        order: "vencimento.asc",
        limit: "5000"
      })
    ]);

    const dashboardByDoc = new Map();
    (clientesDashboard || []).forEach((row) => {
      if (row.cnpj_cpf) dashboardByDoc.set(String(row.cnpj_cpf).replace(/\D/g, ""), row);
    });

    const inadimplentes = groupTitles(titulos || []).map((group) => {
      const cadastro = dashboardByDoc.get(group.cnpj_cpf) || {};
      return {
        ...group,
        cliente_id: cadastro.cliente_id || null,
        cliente: cadastro.cliente || group.cliente,
        status_cobranca: cadastro.status_contato || "EM ABERTO",
        status_cadastro: cadastro.status_cadastro || "",
        data_agendamento: cadastro.data_agendamento || "",
        data_status_cadastro: cadastro.data_status_cadastro || "",
        responsavel: cadastro.responsavel || "",
        observacao: cadastro.observacao || "",
        duplicatas_vencidas: group.duplicatas_vencidas || Number(cadastro.duplicatas_vencidas || 0),
        valor_total: group.valor_total || toNumber(cadastro.valor_total),
        maior_atraso: group.maior_atraso || Number(cadastro.maior_atraso || 0)
      };
    });

    inadimplentes.sort((a, b) => b.valor_total - a.valor_total);

    const totalVencido = inadimplentes
      .filter((item) => !["PERMUTA", "DESCONSIDERADO"].includes(item.status_cadastro))
      .reduce((sum, item) => sum + toNumber(item.valor_total), 0);

    const totalProtestado = inadimplentes
      .filter((item) => item.status_cadastro === "PROTESTADO")
      .reduce((sum, item) => sum + toNumber(item.valor_total), 0);

    return NextResponse.json({
      atualizado_em: new Date().toISOString(),
      total_vencido: Number(totalVencido.toFixed(2)),
      total_protestado: Number(totalProtestado.toFixed(2)),
      clientes_inadimplentes: inadimplentes.length,
      duplicatas_vencidas: inadimplentes.reduce((sum, item) => sum + Number(item.duplicatas_vencidas || 0), 0),
      maior_atraso: inadimplentes.reduce((max, item) => Math.max(max, Number(item.maior_atraso || 0)), 0),
      inadimplentes
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

