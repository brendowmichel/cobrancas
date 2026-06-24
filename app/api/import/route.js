import { NextResponse } from "next/server";
import { read, utils } from "xlsx";
import { randomUUID } from "node:crypto";
import { BASE_FIELDS, normalizeRecord, titlePayload } from "@/lib/cobrancas";
import { TABLES, supabaseGet, supabasePatch, supabasePost, supabaseUpsert } from "@/lib/supabase";
import { onlyDigits } from "@/lib/format";

export const dynamic = "force-dynamic";

const HEADER_ALIASES = {
  cliente: ["RAZAO SOCIAL", "RAZÃO SOCIAL", "CLIENTE"],
  cnpj_cpf: ["CNPJ/CPF", "CPF/CNPJ", "DOCUMENTO"],
  emissao: ["EMISSAO", "EMISSÃO"],
  vencimento: ["VENCIMENTO"],
  categoria: ["CATEGORIA"],
  parcela: ["PARCELA"],
  numero: ["NUMERO", "NÚMERO", "RPS"],
  boleto: ["BOLETO"],
  valor_conta: ["VALOR DA CONTA", "VALOR CONTA"],
  valor_recebido: ["RECEBIDO", "VALOR RECEBIDO"],
  valor_a_receber: ["A RECEBER", "VALOR A RECEBER"]
};

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!file) {
      return NextResponse.json({ error: "Arquivo nao enviado." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = read(buffer, { type: "buffer", cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const rows = utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: "" });
    const parsed = parseRows(rows);

    const now = new Date().toISOString();
    const resumo = {
      registros_lidos: parsed.records.length,
      ja_existiam: 0,
      atualizados: 0,
      novas_cobrancas: 0,
      possiveis_duplicidades: 0,
      ignorados: parsed.ignored,
      removidos: 0
    };

    const existingRows = await supabaseGet(TABLES.TITULOS, {
      select: BASE_FIELDS.concat(["cliente_id"]).join(","),
      limit: "10000"
    });

    const byHash = new Map();
    (existingRows || []).forEach((row) => {
      if (row.hash_identificacao) byHash.set(row.hash_identificacao, row);
    });

    const importedHashes = new Set();
    const titlesPayload = [];
    const clientsPayloadByDoc = new Map();

    parsed.records.forEach((raw) => {
      const record = normalizeRecord(raw);
      importedHashes.add(record.hash_identificacao);

      const existing = byHash.get(record.hash_identificacao);
      if (existing) {
        resumo.ja_existiam += 1;
        if (existing.hash_conteudo !== record.hash_conteudo) resumo.atualizados += 1;
        titlesPayload.push(
          titlePayload({
            ...existing,
            ...record,
            id_interno: existing.id_interno,
            data_primeira_importacao: existing.data_primeira_importacao,
            data_ultima_importacao: now,
            origem_arquivo: file.name,
            ativo_na_ultima_importacao: true
          })
        );
      } else {
        resumo.novas_cobrancas += 1;
        titlesPayload.push(
          titlePayload({
            ...record,
            id_interno: randomUUID(),
            data_primeira_importacao: now,
            data_ultima_importacao: now,
            origem_arquivo: file.name,
            ativo_na_ultima_importacao: true
          })
        );
      }

      const doc = onlyDigits(record.cnpj_cpf);
      if (doc) {
        clientsPayloadByDoc.set(doc, {
          cnpj_cpf: doc,
          cliente: record.cliente,
          status_cobranca: "EM ABERTO",
          status_cadastro: null,
          tipo_status: "CONTATO",
          data_primeira_importacao: now,
          data_ultima_importacao: now,
          origem_arquivo: file.name,
          ativo_na_ultima_importacao: true
        });
      }
    });

    const clientsPayload = Array.from(clientsPayloadByDoc.values());
    if (clientsPayload.length) {
      await supabaseUpsert(TABLES.CLIENTES, clientsPayload, "cnpj_cpf", "resolution=merge-duplicates,return=minimal");
    }

    const clients = await supabaseGet(TABLES.CLIENTES, {
      select: "id,cnpj_cpf",
      limit: "10000"
    });
    const clientIdByDoc = new Map((clients || []).map((client) => [onlyDigits(client.cnpj_cpf), client.id]));
    titlesPayload.forEach((title) => {
      title.cliente_id = clientIdByDoc.get(onlyDigits(title.cnpj_cpf)) || null;
    });

    if (titlesPayload.length) {
      await supabaseUpsert(TABLES.TITULOS, titlesPayload, "hash_identificacao", "resolution=merge-duplicates,return=minimal");
    }

    const inactiveHashes = (existingRows || [])
      .map((row) => row.hash_identificacao)
      .filter((hash) => hash && !importedHashes.has(hash));

    if (inactiveHashes.length && inactiveHashes.length < 500) {
      await supabasePatch(
        TABLES.TITULOS,
        { ativo_na_ultima_importacao: false, data_ultima_importacao: now, origem_arquivo: file.name },
        { hash_identificacao: `in.(${inactiveHashes.join(",")})` },
        "return=minimal"
      );
      resumo.removidos = inactiveHashes.length;
    }

    await supabasePost(
      TABLES.LOGS,
      [
        {
          data_importacao: now,
          versao: "next",
          origem_arquivo: file.name,
          aba_origem: sheetName,
          registros_lidos: resumo.registros_lidos,
          ja_existiam: resumo.ja_existiam,
          atualizados: resumo.atualizados,
          novas_cobrancas: resumo.novas_cobrancas,
          possiveis_duplicidades: resumo.possiveis_duplicidades,
          ignorados: resumo.ignorados,
          removidos: resumo.removidos,
          observacao: "Importacao Next.js"
        }
      ],
      null,
      "return=minimal"
    );

    return NextResponse.json(resumo);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function parseRows(rows) {
  const headerIndex = rows.findIndex((row) => {
    const values = row.map((cell) => normalizeHeader(cell));
    return values.includes("CNPJ/CPF") && values.includes("VENCIMENTO") && values.some((value) => value.includes("VALOR"));
  });

  if (headerIndex < 0) {
    throw new Error("Nao foi possivel detectar o cabecalho do Excel.");
  }

  const headers = rows[headerIndex].map((cell) => normalizeHeader(cell));
  const indexes = {};

  Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
    indexes[field] = headers.findIndex((header) => aliases.includes(header));
  });

  const records = [];
  let ignored = 0;

  rows.slice(headerIndex + 1).forEach((row) => {
    const raw = {};
    Object.entries(indexes).forEach(([field, index]) => {
      raw[field] = index >= 0 ? row[index] : "";
    });

    if (!raw.cnpj_cpf || !raw.vencimento || !raw.valor_a_receber) {
      ignored += 1;
      return;
    }

    records.push(raw);
  });

  return { records, ignored };
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

