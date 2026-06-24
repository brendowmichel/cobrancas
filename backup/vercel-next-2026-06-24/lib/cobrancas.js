import crypto from "node:crypto";
import { daysBetween, normalizeText, onlyDigits, parseIsoDate, toNumber, todayIso } from "./format";

export const BASE_FIELDS = [
  "id_interno",
  "hash_identificacao",
  "hash_conteudo",
  "data_primeira_importacao",
  "data_ultima_importacao",
  "origem_arquivo",
  "ativo_na_ultima_importacao",
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
  "observacao",
  "responsavel",
  "status_negociacao"
];

export const CONTENT_FIELDS = [
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
  "status_cobranca"
];

const IDENTIFICATION_FIELDS = [
  "cnpj_cpf",
  "emissao",
  "vencimento",
  "parcela",
  "numero",
  "categoria",
  "valor_conta"
];

export function sha(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function hashByFields(record, fields) {
  return sha(fields.map((field) => `${field}:${record[field] ?? ""}`).join("|"));
}

export function normalizeMoney(value) {
  return toNumber(value).toFixed(2);
}

export function normalizeDate(value) {
  if (!value) return "";
  if (typeof value === "number") {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86400000).toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

export function normalizeRecord(record) {
  const normalized = {
    cliente: normalizeText(record.cliente),
    cnpj_cpf: onlyDigits(record.cnpj_cpf),
    emissao: normalizeDate(record.emissao),
    vencimento: normalizeDate(record.vencimento),
    categoria: normalizeText(record.categoria),
    parcela: normalizeText(record.parcela),
    numero: normalizeText(record.numero),
    boleto: normalizeText(record.boleto),
    valor_conta: normalizeMoney(record.valor_conta),
    valor_recebido: normalizeMoney(record.valor_recebido),
    valor_a_receber: normalizeMoney(record.valor_a_receber)
  };

  normalized.status_cobranca = record.status_cobranca || calculateStatus(normalized);
  normalized.hash_identificacao = hashByFields(normalized, IDENTIFICATION_FIELDS);
  normalized.hash_conteudo = hashByFields(normalized, CONTENT_FIELDS);
  return normalized;
}

export function calculateStatus(record) {
  const aberto = toNumber(record.valor_a_receber);
  const recebido = toNumber(record.valor_recebido);
  const vencimento = parseIsoDate(record.vencimento);
  const hoje = parseIsoDate(todayIso());

  if (aberto <= 0) return "RECEBIDO";
  if (recebido > 0) return "PARCIAL";
  if (vencimento && daysBetween(vencimento, hoje) > 0) return "VENCIDO";
  return "EM ABERTO";
}

export function titlePayload(record) {
  return {
    id_interno: record.id_interno,
    hash_identificacao: record.hash_identificacao,
    hash_conteudo: record.hash_conteudo,
    data_primeira_importacao: record.data_primeira_importacao || null,
    data_ultima_importacao: record.data_ultima_importacao || null,
    origem_arquivo: record.origem_arquivo || "",
    cliente_id: record.cliente_id || null,
    ativo_na_ultima_importacao: record.ativo_na_ultima_importacao !== false,
    cliente: record.cliente || "",
    cnpj_cpf: onlyDigits(record.cnpj_cpf),
    emissao: record.emissao || null,
    vencimento: record.vencimento || null,
    categoria: record.categoria || "",
    parcela: record.parcela || "",
    numero: record.numero || "",
    boleto: record.boleto || "",
    valor_conta: toNumber(record.valor_conta),
    valor_recebido: toNumber(record.valor_recebido),
    valor_a_receber: toNumber(record.valor_a_receber),
    status_cobranca: record.status_cobranca || "",
    observacao: record.observacao || "",
    responsavel: record.responsavel || "",
    status_negociacao: record.status_negociacao || ""
  };
}

export function groupTitles(titles) {
  const groups = new Map();
  const hoje = parseIsoDate(todayIso());

  titles.forEach((title) => {
    if (title.ativo_na_ultima_importacao === false) return;
    const valor = toNumber(title.valor_a_receber);
    const vencimento = parseIsoDate(title.vencimento);
    const atraso = daysBetween(vencimento, hoje);
    if (!vencimento || valor <= 0 || atraso <= 0) return;

    const doc = onlyDigits(title.cnpj_cpf);
    if (!groups.has(doc)) {
      groups.set(doc, {
        id: doc,
        cliente: title.cliente || "SEM CLIENTE",
        cnpj_cpf: doc,
        status_cobranca: "EM ABERTO",
        status_cadastro: "",
        data_agendamento: "",
        data_status_cadastro: "",
        responsavel: "",
        observacao: "",
        duplicatas_vencidas: 0,
        valor_total: 0,
        maior_atraso: 0,
        duplicatas: []
      });
    }

    const group = groups.get(doc);
    group.valor_total += valor;
    group.maior_atraso = Math.max(group.maior_atraso, atraso);
    group.duplicatas.push({
      numero: title.numero || "",
      status_cobranca: title.status_cobranca || calculateStatus(title),
      vencimento: title.vencimento,
      dias_atraso: atraso,
      categoria: title.categoria || "",
      valor_a_receber: valor
    });
  });

  return Array.from(groups.values()).map((group) => {
    group.duplicatas = groupDuplicateRows(group.duplicatas);
    group.duplicatas_vencidas = group.duplicatas.length;
    group.valor_total = Number(group.valor_total.toFixed(2));
    return group;
  });
}

function groupDuplicateRows(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = [row.numero, row.vencimento].join("|");
    const current = map.get(key);
    if (!current) {
      map.set(key, { ...row, categorias: new Set([row.categoria].filter(Boolean)), itens: 1 });
      return;
    }
    current.valor_a_receber += row.valor_a_receber;
    current.dias_atraso = Math.max(current.dias_atraso, row.dias_atraso);
    current.itens += 1;
    if (row.categoria) current.categorias.add(row.categoria);
  });

  return Array.from(map.values()).map((row) => ({
    ...row,
    categoria: Array.from(row.categorias || []).join(" + "),
    valor_a_receber: Number(row.valor_a_receber.toFixed(2))
  }));
}

