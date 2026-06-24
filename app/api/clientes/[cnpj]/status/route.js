import { NextResponse } from "next/server";
import { TABLES, supabaseGet, supabasePost, supabaseUpsert } from "@/lib/supabase";
import { onlyDigits } from "@/lib/format";

const STATUS_CONTATO = new Set(["EM ABERTO", "EM CONTATO", "AGENDADO", "FINALIZADO"]);
const STATUS_CADASTRO = new Set(["", "SUSPENSO", "CANCELADO", "PROTESTADO", "PERMUTA", "DESCONSIDERADO"]);

export const dynamic = "force-dynamic";

export async function PATCH(request, context) {
  try {
    const params = await context.params;
    const cnpj = onlyDigits(params.cnpj);
    const body = await request.json();

    const statusContato = String(body.status_cobranca || "EM ABERTO").toUpperCase();
    const statusCadastro = String(body.status_cadastro || "").toUpperCase();

    if (!STATUS_CONTATO.has(statusContato)) {
      return NextResponse.json({ error: "Status de contato invalido." }, { status: 400 });
    }

    if (!STATUS_CADASTRO.has(statusCadastro)) {
      return NextResponse.json({ error: "Status de cadastro invalido." }, { status: 400 });
    }

    const existing = await supabaseGet(TABLES.CLIENTES, {
      select: "*",
      cnpj_cpf: `eq.${cnpj}`,
      limit: "1"
    });

    const atual = existing?.[0] || {};
    const now = new Date().toISOString();
    const payload = {
      cnpj_cpf: cnpj,
      cliente: body.cliente || atual.cliente || "",
      status_cobranca: statusContato,
      status_cadastro: statusCadastro || null,
      data_agendamento: body.data_agendamento || null,
      data_status_cadastro: body.data_status_cadastro || null,
      tipo_status: "CONTATO",
      responsavel: body.responsavel || atual.responsavel || "",
      observacao: body.observacao || "",
      data_primeira_importacao: atual.data_primeira_importacao || now,
      data_ultima_importacao: now,
      origem_arquivo: atual.origem_arquivo || "next-app",
      ativo_na_ultima_importacao: true
    };

    const saved = await supabaseUpsert(
      TABLES.CLIENTES,
      [payload],
      "cnpj_cpf",
      "resolution=merge-duplicates,return=representation"
    );

    await supabasePost(
      TABLES.HISTORICO,
      [
        {
          cnpj_cpf: cnpj,
          cliente: payload.cliente,
          status_anterior: atual.status_cobranca || "",
          status_novo: statusContato,
          status_cadastro_anterior: atual.status_cadastro || "",
          status_cadastro_novo: statusCadastro || "",
          observacao: payload.observacao,
          responsavel: payload.responsavel,
          data_alteracao: now
        }
      ],
      null,
      "return=minimal"
    );

    return NextResponse.json({ ok: true, cliente: saved?.[0] || payload });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

