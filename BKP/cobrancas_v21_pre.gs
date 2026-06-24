// SISTEMA DE GESTAO DE COBRANCAS - Apps Script v16
// Base em Google Sheets com controle interno por id_interno, hash_identificacao e hash_conteudo.

const APP_VERSION = "v20";

const SHEETS = {
  BASE: "Base_Cobrancas",
  IMPORTACAO: "Importacao",
  DUPLICIDADES: "Possiveis Duplicidades",
  CLIENTES: "Clientes",
  LOGS: "Log_Importacoes"
};

const BASE_HEADERS = [
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

const DUPLICIDADE_HEADERS = [
  "data_deteccao",
  "tipo",
  "id_interno_existente",
  "hash_existente",
  "hash_importada",
  "cliente",
  "cnpj_cpf",
  "emissao",
  "vencimento",
  "categoria",
  "parcela",
  "numero",
  "valor_conta",
  "observacao_tecnica"
];

const LOG_HEADERS = [
  "data_importacao",
  "versao",
  "origem_arquivo",
  "aba_origem",
  "registros_lidos",
  "ja_existiam",
  "atualizados",
  "novas_cobrancas",
  "possiveis_duplicidades",
  "ignorados",
  "observacao"
];

const CLIENT_HEADERS = [
  "cnpj_cpf",
  "cliente",
  "status_cobranca",
  "status_cadastro",
  "data_agendamento",
  "tipo_status",
  "responsavel",
  "observacao",
  "data_primeira_importacao",
  "data_ultima_importacao",
  "origem_arquivo",
  "ativo_na_ultima_importacao"
];

const STATUS_CONTATO_CLIENTE = ["EM ABERTO", "EM CONTATO", "AGENDADO"];
const STATUS_CADASTRO_CLIENTE = ["SUSPENSO", "CANCELADO", "PROTESTADO", "PERMUTA", "DESCONSIDERADO"];
const STATUS_CLIENTE_PADRAO = "EM ABERTO";

const FIELD_ALIASES = {
  cliente: ["RAZAO SOCIAL", "CLIENTE", "NOME", "NOME CLIENTE"],
  cnpj_cpf: ["CNPJ/CPF", "CPF/CNPJ", "DOCUMENTO CLIENTE", "CNPJ", "CPF"],
  emissao: ["EMISSAO", "DATA EMISSAO"],
  vencimento: ["VENCIMENTO", "DATA VENCIMENTO", "DT VENCIMENTO"],
  categoria: ["CATEGORIA", "PLANO DE CONTA", "CENTRO DE CUSTO"],
  parcela: ["PARCELA"],
  numero: ["NUMERO", "RPS", "NOTA", "NOTA FISCAL"],
  boleto: ["BOLETO", "NOSSO NUMERO"],
  valor_conta: ["VALOR DA CONTA", "VALOR CONTA", "VALOR", "VALOR BRUTO"],
  valor_recebido: ["RECEBIDO", "VALOR RECEBIDO"],
  valor_a_receber: ["A RECEBER", "VALOR A RECEBER", "SALDO A RECEBER"],
  status_cobranca: ["STATUS", "STATUS COBRANCA", "SITUACAO"]
};

const HASH_IDENTIFICACAO_FIELDS = [
  "cnpj_cpf",
  "emissao",
  "vencimento",
  "parcela",
  "numero",
  "categoria",
  "valor_conta"
];

const HASH_CONTEUDO_FIELDS = [
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

const MANUAL_FIELDS = ["observacao", "responsavel", "status_negociacao"];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Cobrancas")
    .addItem("Preparar abas", "setupSistemaCobrancas")
    .addSeparator()
    .addItem("Importar aba ativa", "importarCobrancasDaAbaAtiva")
    .addItem("Importar aba Importacao", "importarCobrancasDaAbaPadrao")
    .addToUi();
}

function doGet() {
  return HtmlService
    .createHtmlOutput(getWebAppHtml_())
    .setTitle("Cobrancas " + APP_VERSION)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setupSistemaCobrancas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const base = ensureSheet_(ss, SHEETS.BASE, BASE_HEADERS);
  const duplicidades = ensureSheet_(ss, SHEETS.DUPLICIDADES, DUPLICIDADE_HEADERS);
  const clientes = ensureSheet_(ss, SHEETS.CLIENTES, CLIENT_HEADERS);
  const logs = ensureSheet_(ss, SHEETS.LOGS, LOG_HEADERS);
  ensureSheet_(ss, SHEETS.IMPORTACAO, []);

  freezeHeader_(base);
  freezeHeader_(duplicidades);
  freezeHeader_(clientes);
  freezeHeader_(logs);
  hideTechnicalColumns_(base);

  SpreadsheetApp.getActive().toast("Abas preparadas - " + APP_VERSION, "Cobrancas", 5);
}

function getEstadoSistema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const faltantes = [];

  if (!sheetHasHeaders_(ss, SHEETS.BASE, BASE_HEADERS)) faltantes.push(SHEETS.BASE);
  if (!ss.getSheetByName(SHEETS.IMPORTACAO)) faltantes.push(SHEETS.IMPORTACAO);
  if (!sheetHasHeaders_(ss, SHEETS.DUPLICIDADES, DUPLICIDADE_HEADERS)) faltantes.push(SHEETS.DUPLICIDADES);
  if (!sheetHasHeaders_(ss, SHEETS.CLIENTES, CLIENT_HEADERS)) faltantes.push(SHEETS.CLIENTES);
  if (!sheetHasHeaders_(ss, SHEETS.LOGS, LOG_HEADERS)) faltantes.push(SHEETS.LOGS);

  return {
    preparado: faltantes.length === 0,
    abas_faltantes: faltantes
  };
}

function getDashboardCobrancas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const baseSheet = ss.getSheetByName(SHEETS.BASE);
  const clientesSheet = ss.getSheetByName(SHEETS.CLIENTES);

  if (!baseSheet) {
    return {
      atualizado_em: formatDateTime_(new Date()),
      kpis: kpisVazios_(),
      inadimplentes: [],
      proximos_vencimentos: [],
      sugestoes: []
    };
  }

  const clientes = clientesSheet ? carregarClientes_(clientesSheet).porDocumento : {};

  const base = carregarBase_(baseSheet).lista.map(function (item) {
    return item.obj;
  }).filter(function (item) {
    return item.ativo_na_ultima_importacao !== "NAO";
  });

  const hoje = parseIsoDate_(formatDate_(new Date()));
  const grupos = {};
  let totalAberto = 0;
  let totalVencido = 0;
  let qtdVencidas = 0;
  let qtdAbertas = 0;
  let maiorAtraso = 0;

  base.forEach(function (cobranca) {
    const valorAberto = parseNumber_(cobranca.valor_a_receber);
    if (valorAberto <= 0) return;

    const vencimento = parseIsoDate_(cobranca.vencimento);
    const diasAtraso = vencimento ? diasEntre_(vencimento, hoje) : 0;
    const estaVencida = Boolean(vencimento && diasAtraso > 0);

    totalAberto += valorAberto;
    qtdAbertas += 1;

    if (estaVencida) {
      totalVencido += valorAberto;
      qtdVencidas += 1;
      maiorAtraso = Math.max(maiorAtraso, diasAtraso);
      adicionarCobrancaAoGrupo_(grupos, cobranca, valorAberto, diasAtraso);
    }
  });

  let qtdVencidasAgrupadas = 0;

  const inadimplentes = Object.keys(grupos).map(function (key) {
    const grupo = grupos[key];
    const clienteCadastro = clientes[grupo.cnpj_cpf] ? clientes[grupo.cnpj_cpf].obj : null;
    aplicarCadastroClienteAoGrupo_(grupo, clienteCadastro);
    grupo.duplicatas = agruparDuplicatasPorRps_(grupo.duplicatas);
    grupo.duplicatas_vencidas = grupo.duplicatas.length;
    qtdVencidasAgrupadas += grupo.duplicatas_vencidas;
    grupo.valor_total = arredondar2_(grupo.valor_total);
    grupo.maior_atraso = Math.max.apply(null, grupo.duplicatas.map(function (item) {
      return item.dias_atraso;
    }));
    grupo.duplicatas.sort(ordenarDuplicatasCobranca_);
    return grupo;
  }).sort(function (a, b) {
    if (b.valor_total !== a.valor_total) return b.valor_total - a.valor_total;
    return b.maior_atraso - a.maior_atraso;
  });

  return {
    atualizado_em: formatDateTime_(new Date()),
    kpis: {
      total_aberto: arredondar2_(totalAberto),
      total_vencido: arredondar2_(totalVencido),
      total_vencido_ajustado: arredondar2_(inadimplentes
        .filter(function(g) { return g.status_cadastro !== "PERMUTA" && g.status_cadastro !== "DESCONSIDERADO"; })
        .reduce(function(acc, g) { return acc + (g.valor_total || 0); }, 0)),
      clientes_inadimplentes: inadimplentes.length,
      duplicatas_vencidas: qtdVencidasAgrupadas,
      duplicatas_abertas: qtdAbertas,
      vence_7_dias: 0,
      maior_atraso: maiorAtraso
    },
    inadimplentes: inadimplentes.slice(0, 200),
    proximos_vencimentos: [],
    sugestoes: []
  };
}

function aplicarCadastroClienteAoGrupo_(grupo, clienteCadastro) {
  const statusContato = clienteCadastro ? normalizarStatusCliente_(clienteCadastro.status_cobranca) : STATUS_CLIENTE_PADRAO;
  const statusCadastro = clienteCadastro ? normalizarStatusCadastro_(clienteCadastro.status_cadastro) : "";

  grupo.status_cliente = statusContato;
  grupo.tipo_status_cliente = "CONTATO";
  grupo.status_contato = statusContato;
  grupo.status_cadastro = statusCadastro;
  grupo.data_agendamento_cliente = clienteCadastro ? clienteCadastro.data_agendamento || "" : "";
  grupo.observacao_cliente = clienteCadastro ? clienteCadastro.observacao || "" : "";
  grupo.responsavel_cliente = clienteCadastro ? clienteCadastro.responsavel || "" : "";
}

function kpisVazios_() {
  return {
    total_aberto: 0,
    total_vencido: 0,
    clientes_inadimplentes: 0,
    duplicatas_vencidas: 0,
    duplicatas_abertas: 0,
    vence_7_dias: 0,
    maior_atraso: 0
  };
}

function adicionarCobrancaAoGrupo_(grupos, cobranca, valorAberto, diasAtraso) {
  const key = cobranca.cnpj_cpf || cobranca.cliente || "SEM_DOCUMENTO";

  if (!grupos[key]) {
    grupos[key] = {
      id: key,
      cliente: cobranca.cliente || "SEM CLIENTE",
      cnpj_cpf: cobranca.cnpj_cpf || "",
      duplicatas_vencidas: 0,
      valor_total: 0,
      maior_atraso: 0,
      responsavel: cobranca.responsavel || "",
      status_negociacao: cobranca.status_negociacao || "",
      duplicatas: []
    };
  }

  grupos[key].valor_total += valorAberto;
  grupos[key].duplicatas.push(montarResumoCobranca_(cobranca, valorAberto, diasAtraso));
}

function montarResumoCobranca_(cobranca, valorAberto, diasAtraso) {
  return {
    id_interno: cobranca.id_interno || "",
    cliente: cobranca.cliente || "",
    cnpj_cpf: cobranca.cnpj_cpf || "",
    emissao: cobranca.emissao || "",
    vencimento: cobranca.vencimento || "",
    dias_atraso: diasAtraso || 0,
    categoria: cobranca.categoria || "",
    parcela: cobranca.parcela || "",
    numero: cobranca.numero || "",
    boleto: cobranca.boleto || "",
    valor_conta: parseNumber_(cobranca.valor_conta),
    valor_recebido: parseNumber_(cobranca.valor_recebido),
    valor_a_receber: arredondar2_(valorAberto),
    status_cobranca: cobranca.status_cobranca || "",
    responsavel: cobranca.responsavel || "",
    status_negociacao: cobranca.status_negociacao || "",
    observacao: cobranca.observacao || ""
  };
}

function agruparDuplicatasPorRps_(duplicatas) {
  const grupos = {};
  const resultado = [];

  duplicatas.forEach(function (dup) {
    const key = chaveDuplicataVisual_(dup);
    if (!grupos[key]) {
      grupos[key] = Object.assign({}, dup, {
        id_interno: dup.id_interno || "",
        valor_conta: arredondar2_(dup.valor_conta),
        valor_recebido: arredondar2_(dup.valor_recebido),
        valor_a_receber: arredondar2_(dup.valor_a_receber),
        categorias_agrupadas: dup.categoria ? [dup.categoria] : [],
        status_agrupados: dup.status_cobranca ? [dup.status_cobranca] : [],
        itens_agrupados: 1
      });
      resultado.push(grupos[key]);
      return;
    }

    const atual = grupos[key];
    atual.id_interno = juntarUnicos_([atual.id_interno, dup.id_interno]);
    atual.valor_conta = arredondar2_(atual.valor_conta + dup.valor_conta);
    atual.valor_recebido = arredondar2_(atual.valor_recebido + dup.valor_recebido);
    atual.valor_a_receber = arredondar2_(atual.valor_a_receber + dup.valor_a_receber);
    atual.categorias_agrupadas = adicionarUnico_(atual.categorias_agrupadas, dup.categoria);
    atual.status_agrupados = adicionarUnico_(atual.status_agrupados, dup.status_cobranca);
    atual.categoria = atual.categorias_agrupadas.join(" + ");
    atual.status_cobranca = statusDuplicataAgrupada_(atual.status_agrupados);
    atual.itens_agrupados += 1;
  });

  resultado.forEach(function (dup) {
    dup.categoria = (dup.categorias_agrupadas || []).join(" + ") || dup.categoria || "";
    dup.status_cobranca = statusDuplicataAgrupada_(dup.status_agrupados || [dup.status_cobranca]);
  });

  return resultado;
}

function chaveDuplicataVisual_(dup) {
  if (dup.numero) {
    return ["RPS", dup.numero, dup.vencimento || ""].join("|");
  }

  return ["ID", dup.id_interno || dup.vencimento || "", dup.categoria || "", dup.valor_a_receber || ""].join("|");
}

function adicionarUnico_(lista, valor) {
  if (valor && lista.indexOf(valor) < 0) lista.push(valor);
  return lista;
}

function juntarUnicos_(valores) {
  const lista = [];
  valores.forEach(function (valor) {
    String(valor || "").split(",").forEach(function (item) {
      const clean = item.trim();
      if (clean && lista.indexOf(clean) < 0) lista.push(clean);
    });
  });
  return lista.join(",");
}

function statusDuplicataAgrupada_(statusList) {
  const statuses = (statusList || []).filter(Boolean);
  if (statuses.indexOf("PARCIAL") >= 0) return "PARCIAL";
  if (statuses.indexOf("VENCIDO") >= 0) return "VENCIDO";
  if (statuses.indexOf("EM ABERTO") >= 0) return "EM ABERTO";
  if (statuses.indexOf("RECEBIDO") >= 0) return "RECEBIDO";
  return statuses[0] || "VENCIDO";
}

function ordenarDuplicatasCobranca_(a, b) {
  if (b.dias_atraso !== a.dias_atraso) return b.dias_atraso - a.dias_atraso;
  return b.valor_a_receber - a.valor_a_receber;
}

function diasEntre_(inicio, fim) {
  const msDia = 24 * 60 * 60 * 1000;
  return Math.floor((fim.getTime() - inicio.getTime()) / msDia);
}

function arredondar2_(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function getWebAppHtml_() {
  return `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cobrancas ${APP_VERSION}</title>
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"><\/script>
  <style type="text/tailwindcss">
    @layer components {
      /* ── Buttons ─────────────────────────────────────── */
      .btn-primary {
        @apply inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-colors cursor-pointer bg-slate-800 text-white hover:bg-slate-700 px-4 text-sm leading-none;
        height: 36px;
      }
      .btn-secondary, .secondary {
        @apply inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors cursor-pointer bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 px-4 text-sm leading-none;
        height: 36px;
      }
      .secondary.small {
        @apply px-3 text-xs;
        height: 28px;
      }

      /* ── Sort buttons ────────────────────────────────── */
      .sort-btn {
        @apply inline-flex items-center gap-1 bg-transparent p-0 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 transition-colors whitespace-nowrap;
        border: 0;
      }
      .sort-mark {
        @apply inline-block w-3 text-center text-slate-600 font-bold;
      }

      /* ── Table rows ──────────────────────────────────── */
      .main-table tbody td {
        @apply px-5 py-3.5 border-b border-gray-100 text-sm text-gray-700 align-middle;
      }
      .main-table tbody tr:last-child td {
        @apply border-b-0;
      }
      .cliente-row {
        @apply cursor-pointer transition-colors hover:bg-slate-50;
      }
      .expanded-row { cursor: default; }
      .detail-cell { padding: 0; }
      .inline-detail {
        @apply px-6 py-5 bg-slate-50/60;
      }
      .detail-table { min-width: 620px; }
      .detail-table thead th {
        @apply px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider;
        background: #f8fafc;
      }
      .detail-table tbody td {
        @apply px-3 py-2.5 text-sm text-gray-700 border-b border-gray-100 align-middle;
      }
      .detail-table tbody tr:last-child td { border-bottom: 0; }
      .detail-table tbody tr { cursor: default; }
      .detail-table tbody tr:hover { background: transparent; }

      /* ── Status cell ─────────────────────────────────── */
      .status-cell { min-width: 160px; }
      .status-main { display: block; }
      .status-note {
        @apply block text-xs text-gray-400 mt-0.5 leading-relaxed;
        white-space: normal;
      }

      /* ── Status badges — contato ─────────────────────── */
      .status-badge {
        @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold;
      }
      .status-open      { @apply bg-gray-100 text-gray-500; }
      .status-contact   { @apply bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-200; }
      .status-scheduled { @apply bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-200; }

      /* ── Cadastro tags — cadastro ─────────────────────── */
      .cadastro-tag {
        @apply inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase;
      }
      .cadastro-suspended { @apply bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200; }
      .cadastro-cancelled { @apply bg-red-50 text-red-600 ring-1 ring-inset ring-red-200; }
      .cadastro-protested { @apply bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-300; }
      .cadastro-permuta         { @apply bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200; }
      .cadastro-desconsiderado  { @apply bg-gray-100 text-gray-400 ring-1 ring-inset ring-gray-200; }

      /* ── Pills — status na tabela de detalhe ──────────── */
      .pill {
        @apply inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold;
      }
      .pill-vencido { @apply bg-red-50 text-red-600 ring-1 ring-inset ring-red-200; }
      .pill-aberto  { @apply bg-gray-100 text-gray-500; }
      .pill-parcial { @apply bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-200; }
      .pill-recebido { @apply bg-green-50 text-green-600 ring-1 ring-inset ring-green-200; }

      /* ── Misc ────────────────────────────────────────── */
      .muted  { @apply text-gray-400; }
      .num    { @apply text-right whitespace-nowrap; }
      .ok     { @apply text-green-600; }
      .err    { @apply text-red-600; }
      .warn   { @apply text-amber-600; }
      .client-name  { @apply flex items-center gap-2 flex-wrap; }
      .cell-nome    { display: flex; flex-direction: column; gap: 2px; }
      .cnpj-line    { @apply text-xs text-gray-400; display: block; margin-top: 1px; }
      .action-stack { @apply flex items-center gap-2 justify-end; flex-wrap: nowrap; }
      .actions      { width: 170px; min-width: 170px; text-align: right; }
      .version {
        @apply inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-gray-200 text-gray-400;
      }
      .status-line { @apply text-sm text-gray-400; min-height: 20px; }

      /* ── Toast ───────────────────────────────────────── */
      .toast {
        @apply bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 shadow-lg;
        white-space: pre-wrap;
      }
      .toast.ok   { @apply bg-green-50 border-green-200 text-green-800; }
      .toast.err  { @apply bg-red-50 border-red-200 text-red-800; }
      .toast.warn { @apply bg-amber-50 border-amber-200 text-amber-800; }

      /* ── Modal ───────────────────────────────────────── */
      .modal-backdrop {
        @apply fixed inset-0 hidden items-center justify-center p-4 z-50;
        background: rgba(0,0,0,.4);
      }
      .modal-backdrop.open { @apply flex; }
      .modal {
        @apply w-full bg-white rounded-2xl border border-gray-200 shadow-2xl p-6;
        max-width: 480px;
      }
      .modal-head {
        @apply flex items-start justify-between gap-3 mb-5;
      }
      .form-grid { @apply flex flex-col gap-4; }
    }
  </style>
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen" style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased">

  <main style="max-width:1280px;margin:0 auto;padding:2rem 1.5rem 3rem">

    <!-- ── Header ── -->
    <header class="flex items-center justify-between mb-8">
      <div>
        <h1 style="font-size:1.25rem;font-weight:600;letter-spacing:-.025em;margin:0;color:#111827">Cobranças</h1>
        <p id="subtitulo" class="muted" style="font-size:.875rem;margin:.25rem 0 0">Carregando dados da base...</p>
      </div>
      <span class="version">${APP_VERSION}</span>
    </header>

    <!-- ── KPIs ── -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1.5rem">
      <div style="background:#fff;border:1px solid #f3f4f6;border-radius:.75rem;box-shadow:0 1px 3px rgba(0,0,0,.06);padding:1.25rem">
        <span style="display:block;font-size:.7rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em">Total vencido</span>
        <del id="kpi-vencido-original" style="display:none;font-size:.875rem;font-weight:500;color:#9ca3af;margin-top:.375rem">R$ 0,00</del>
        <strong id="kpi-vencido" style="display:block;font-size:1.5rem;font-weight:700;color:#111827;margin-top:.25rem;font-variant-numeric:tabular-nums;letter-spacing:-.025em">R$ 0,00</strong>
      </div>
      <div style="background:#fff;border:1px solid #f3f4f6;border-radius:.75rem;box-shadow:0 1px 3px rgba(0,0,0,.06);padding:1.25rem">
        <span style="display:block;font-size:.7rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em">Inadimplentes</span>
        <strong id="kpi-clientes" style="display:block;font-size:1.5rem;font-weight:700;color:#111827;margin-top:.5rem">0</strong>
      </div>
      <div style="background:#fff;border:1px solid #f3f4f6;border-radius:.75rem;box-shadow:0 1px 3px rgba(0,0,0,.06);padding:1.25rem">
        <span style="display:block;font-size:.7rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em">Duplicatas vencidas</span>
        <strong id="kpi-duplicatas" style="display:block;font-size:1.5rem;font-weight:700;color:#111827;margin-top:.5rem">0</strong>
      </div>
      <div style="background:#fff;border:1px solid #f3f4f6;border-radius:.75rem;box-shadow:0 1px 3px rgba(0,0,0,.06);padding:1.25rem">
        <span style="display:block;font-size:.7rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em">Maior atraso</span>
        <strong id="kpi-atraso" style="display:block;font-size:1.5rem;font-weight:700;color:#111827;margin-top:.5rem">0 dias</strong>
      </div>
    </div>

    <!-- ── Import ── -->
    <details style="background:#fff;border:1px solid #f3f4f6;border-radius:.75rem;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:1rem">
      <summary style="display:flex;align-items:center;gap:.5rem;padding:1rem 1.25rem;cursor:pointer;list-style:none;font-size:.875rem;font-weight:500;color:#6b7280;user-select:none" class="hover:text-gray-700 transition-colors">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="flex-shrink:0">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Importação
      </summary>
      <div style="padding:0 1.25rem 1.25rem;border-top:1px solid #f3f4f6;margin-top:0;display:flex;flex-direction:column;gap:.75rem;padding-top:1rem">
        <div>
          <label for="arquivo-excel" style="display:block;font-size:.7rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.5rem">Arquivo Excel (.xlsx)</label>
          <input id="arquivo-excel" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style="display:block;width:100%;font-size:.875rem;color:#6b7280;cursor:pointer"
            class="file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-200 file:text-xs file:font-medium file:text-gray-700 file:bg-white hover:file:bg-gray-50 file:cursor-pointer">
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <button type="button" onclick="importarArquivoExcel()" class="btn-primary">Importar Excel</button>
          <button type="button" onclick="importarAbaPadrao()" class="btn-secondary">Importar aba Importação</button>
          <button id="btn-preparar" type="button" onclick="prepararAbas()" class="btn-secondary" hidden>Preparar abas</button>
        </div>
        <div id="import-status" class="status-line"></div>
      </div>
    </details>

    <!-- ── Main table ── -->
    <div style="background:#fff;border:1px solid #f3f4f6;border-radius:.75rem;box-shadow:0 1px 3px rgba(0,0,0,.06);overflow:hidden">

      <div style="display:flex;align-items:center;justify-content:space-between;padding:.875rem 1.25rem;border-bottom:1px solid #f3f4f6">
        <div>
          <h2 style="font-size:1rem;font-weight:600;color:#111827;margin:0">Inadimplentes</h2>
          <p id="lista-info" class="muted" style="font-size:.8125rem;margin:.25rem 0 0">Carregando...</p>
        </div>
        <button type="button" onclick="carregarDashboard()" class="btn-secondary" style="height:30px;padding:0 .75rem;font-size:.75rem">Atualizar</button>
      </div>

      <div style="overflow-x:auto">
        <table class="main-table" style="width:100%;border-collapse:collapse;min-width:900px">
          <thead>
            <tr style="border-bottom:1px solid #f3f4f6;background:#fafafa">
              <th style="padding:.75rem 1.25rem;text-align:left">
                <button type="button" class="sort-btn" onclick="ordenarInadimplentes('cliente')">
                  Nome <span id="sort-cliente" class="sort-mark"></span>
                </button>
              </th>
              <th style="padding:.75rem 1.25rem;text-align:left;font-size:.7rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;min-width:170px">Status</th>
              <th style="padding:.75rem 1.25rem;text-align:right">
                <button type="button" class="sort-btn" style="justify-content:flex-end;width:100%" onclick="ordenarInadimplentes('duplicatas_vencidas')">
                  Duplicatas <span id="sort-duplicatas_vencidas" class="sort-mark"></span>
                </button>
              </th>
              <th style="padding:.75rem 1.25rem;text-align:right">
                <button type="button" class="sort-btn" style="justify-content:flex-end;width:100%" onclick="ordenarInadimplentes('valor_total')">
                  Valor total <span id="sort-valor_total" class="sort-mark"></span>
                </button>
              </th>
              <th style="padding:.75rem 1.25rem;text-align:right;font-size:.7rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap">Maior atraso</th>
              <th class="actions" style="padding:.75rem 1.25rem;font-size:.7rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em">Ações</th>
            </tr>
          </thead>
          <tbody id="inadimplentes-body">
            <tr><td colspan="6" class="px-5 py-10 text-center muted" style="padding:2.5rem;text-align:center">Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

  </main>

  <!-- ── Modal ── -->
  <div id="status-modal" class="modal-backdrop">
    <div class="modal">
      <div class="modal-head">
        <div>
          <h2 style="font-size:1rem;font-weight:600;color:#111827;margin:0">Atualizar status</h2>
          <p id="status-cliente" class="muted" style="font-size:.8125rem;margin:.25rem 0 0"></p>
        </div>
        <button type="button" class="secondary small" onclick="fecharStatusModal()">Fechar</button>
      </div>
      <div class="form-grid">
        <input id="status-id" type="hidden">
        <input id="status-documento" type="hidden">
        <div>
          <label for="status-contato-select" style="display:block;font-size:.7rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.375rem">Status de contato</label>
          <select id="status-contato-select" onchange="var r=document.getElementById('agendamento-row');r.style.display=(this.value==='AGENDADO')?'':'none';if(this.value!=='AGENDADO')document.getElementById('status-data-agendamento').value='';" style="display:block;width:100%;border:1px solid #e5e7eb;border-radius:.5rem;background:#fff;color:#374151;font-size:.875rem;padding:.5rem .75rem;outline:none;font-family:inherit">
            <option value="EM ABERTO">EM ABERTO</option>
            <option value="EM CONTATO">EM CONTATO</option>
            <option value="AGENDADO">AGENDADO</option>
          </select>
        </div>
        <div id="agendamento-row" style="display:none">
          <label for="status-data-agendamento" style="display:block;font-size:.7rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.375rem">Data do agendamento</label>
          <input id="status-data-agendamento" type="date" style="display:block;width:100%;border:1px solid #e5e7eb;border-radius:.5rem;background:#fff;color:#374151;font-size:.875rem;padding:.5rem .75rem;outline:none;font-family:inherit">
        </div>
        <div>
          <label for="status-cadastro-select" style="display:block;font-size:.7rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.375rem">Status de cadastro</label>
          <select id="status-cadastro-select" style="display:block;width:100%;border:1px solid #e5e7eb;border-radius:.5rem;background:#fff;color:#374151;font-size:.875rem;padding:.5rem .75rem;outline:none;font-family:inherit">
            <option value="">Nenhum</option>
            <option value="SUSPENSO">SUSPENSO</option>
            <option value="CANCELADO">CANCELADO</option>
            <option value="PROTESTADO">PROTESTADO</option>
            <option value="PERMUTA">PERMUTA</option>
            <option value="DESCONSIDERADO">DESCONSIDERADO</option>
          </select>
        </div>
        <div>
          <label for="status-observacao" style="display:block;font-size:.7rem;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.375rem">Observação</label>
          <textarea id="status-observacao" rows="3" style="display:block;width:100%;border:1px solid #e5e7eb;border-radius:.5rem;background:#fff;color:#374151;font-size:.875rem;padding:.5rem .75rem;resize:vertical;outline:none;font-family:inherit;box-sizing:border-box"></textarea>
        </div>
        <div style="display:flex;gap:.5rem;padding-top:.25rem">
          <button type="button" onclick="salvarStatusCliente()" class="btn-primary" style="flex:1">Salvar</button>
          <button type="button" onclick="fecharStatusModal()" class="btn-secondary">Cancelar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Toast area ── -->
  <div id="toast-area" style="position:fixed;bottom:1rem;right:1rem;display:flex;flex-direction:column;gap:.5rem;z-index:50;width:380px;max-width:calc(100vw - 2rem)"></div>

  <script>
    let dashboardData = null;
    let inadimplentesView = [];
    let sortState = { key: "valor_total", dir: "desc" };

    const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

    function showToast(texto, classe) {
      const area = document.getElementById("toast-area");
      const toast = document.createElement("div");
      toast.className = "toast " + (classe || "");
      toast.textContent = texto;
      area.appendChild(toast);
      while (area.children.length > 3) area.removeChild(area.firstChild);
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 7000);
    }

    function setImportStatus(texto, classe) {
      const el = document.getElementById("import-status");
      el.className = "status-line " + (classe || "");
      el.textContent = texto || "";
    }

    function prepararAbas() {
      setImportStatus("Preparando abas...");
      google.script.run
        .withSuccessHandler(function () {
          setImportStatus("");
          showToast("Abas preparadas com sucesso.", "ok");
          atualizarEstadoSistema();
          carregarDashboard();
        })
        .withFailureHandler(function (erro) {
          setImportStatus("");
          showToast(erro && erro.message ? erro.message : String(erro), "err");
        })
        .setupSistemaCobrancas();
    }

    function importarAbaPadrao() {
      setImportStatus("Importando aba Importacao...");
      google.script.run
        .withSuccessHandler(function (resumo) {
          setImportStatus("");
          showToast(resumoImportacaoTexto(resumo), "ok");
          carregarDashboard();
        })
        .withFailureHandler(function (erro) {
          setImportStatus("");
          showToast(erro && erro.message ? erro.message : String(erro), "err");
        })
        .importarCobrancasDaAbaPadrao();
    }

    function importarArquivoExcel() {
      const input = document.getElementById("arquivo-excel");
      const arquivo = input.files && input.files[0];

      if (!arquivo) {
        showToast("Selecione um arquivo Excel antes de importar.", "err");
        return;
      }

      if (!/\\.xlsx$/i.test(arquivo.name)) {
        showToast("Use um arquivo .xlsx. Se o arquivo estiver em .xls, abra no Excel/Sheets e salve como .xlsx.", "err");
        return;
      }

      setImportStatus("Lendo arquivo " + arquivo.name + "...");

      const reader = new FileReader();

      reader.onload = function () {
        const dataUrl = String(reader.result || "");
        const base64 = dataUrl.indexOf(",") >= 0 ? dataUrl.split(",")[1] : dataUrl;

        setImportStatus("Enviando e processando arquivo...");

        google.script.run
          .withSuccessHandler(function (resumo) {
            setImportStatus("");
            showToast(resumoImportacaoTexto(resumo), "ok");
            carregarDashboard();
          })
          .withFailureHandler(function (erro) {
            setImportStatus("");
            showToast(erro && erro.message ? erro.message : String(erro), "err");
          })
          .importarArquivoExcelUpload({
            filename: arquivo.name,
            mimeType: arquivo.type,
            base64: base64
          });
      };

      reader.onerror = function () {
        setImportStatus("");
        showToast("Nao foi possivel ler o arquivo selecionado.", "err");
      };

      reader.readAsDataURL(arquivo);
    }

    function resumoImportacaoTexto(resumo) {
      var linhas = [
        resumo.registros_lidos + " registros lidos",
        resumo.ja_existiam + " ja existiam",
        resumo.atualizados + " atualizados",
        resumo.novas_cobrancas + " novas cobrancas adicionadas",
        resumo.possiveis_duplicidades + " possiveis duplicidades encontradas",
        resumo.ignorados + " ignorados"
      ];
      if (resumo.removidos) linhas.push(resumo.removidos + " removidos (pagos/quitados)");
      return linhas.join("\\n");
    }

    function carregarDashboard() {
      document.getElementById("subtitulo").textContent = "Atualizando dashboard...";

      google.script.run
        .withSuccessHandler(function (data) {
          dashboardData = data;
          renderDashboard(data);
        })
        .withFailureHandler(function (erro) {
          document.getElementById("subtitulo").textContent = "Nao foi possivel carregar o dashboard.";
          showToast(erro && erro.message ? erro.message : String(erro), "err");
        })
        .getDashboardCobrancas();
    }

    function renderDashboard(data) {
      const kpis = data.kpis || {};
      document.getElementById("subtitulo").textContent = "Atualizado em " + (data.atualizado_em || "");
      var _vencOrig = kpis.total_vencido || 0;
      var _vencAdj  = (kpis.total_vencido_ajustado !== undefined) ? kpis.total_vencido_ajustado : _vencOrig;
      var _origEl   = document.getElementById("kpi-vencido-original");
      var _kpiEl    = document.getElementById("kpi-vencido");
      _kpiEl.textContent = moeda.format(_vencAdj);
      if (_origEl) {
        if (Math.round(_vencAdj * 100) !== Math.round(_vencOrig * 100)) {
          _origEl.textContent = moeda.format(_vencOrig);
          _origEl.style.display = "block";
          _kpiEl.style.color = "#ef4444";
        } else {
          _origEl.style.display = "none";
          _kpiEl.style.color = "#111827";
        }
      }
      document.getElementById("kpi-clientes").textContent = kpis.clientes_inadimplentes || 0;
      document.getElementById("kpi-duplicatas").textContent = kpis.duplicatas_vencidas || 0;
      document.getElementById("kpi-atraso").textContent = (kpis.maior_atraso || 0) + " dias";
      inadimplentesView = (data.inadimplentes || []).slice();
      aplicarOrdenacaoInadimplentes();
      renderInadimplentes(inadimplentesView);
    }

    function renderInadimplentes(lista) {
      const body = document.getElementById("inadimplentes-body");
      body.innerHTML = "";
      document.getElementById("lista-info").textContent = lista.length + " cliente(s) com duplicatas vencidas.";
      atualizarMarcadoresOrdenacao();

      if (!lista.length) {
        body.innerHTML = '<tr><td colspan="6" class="px-5 py-10 text-center muted">Nenhum inadimplente encontrado.</td></tr>';
        return;
      }

      lista.forEach(function (item) {
        const tr = document.createElement("tr");
        tr.className = "cliente-row";
        tr.dataset.id = item.id;
        tr.innerHTML =
          "<td><div class='cell-nome'>" + clienteNomeHtml(item) + "<span class='cnpj-line'>" + escapeHtml(item.cnpj_cpf) + "</span></div></td>" +
          "<td class='status-cell'>" + statusClienteHtml(item) + "</td>" +
          "<td class='num'>" + item.duplicatas_vencidas + "</td>" +
          "<td class='num'><strong>" + moeda.format(item.valor_total || 0) + "</strong></td>" +
          "<td class='num'>" + (item.maior_atraso || 0) + " dias</td>" +
          "<td class='actions'><span class='action-stack'>" +
            "<button type='button' class='secondary small' onclick='copiarResumoCliente(&quot;" + escapeAttr(item.id) + "&quot;, event)'>Resumo</button>" +
            "<button type='button' class='secondary small' onclick='abrirStatusCliente(&quot;" + escapeAttr(item.id) + "&quot;, event)'>Status</button>" +
          "</span></td>";
        tr.addEventListener("click", function () {
          toggleDetalheCliente(item);
        });
        body.appendChild(tr);

        const detailTr = document.createElement("tr");
        detailTr.className = "expanded-row";
        detailTr.dataset.detailFor = item.id;
        detailTr.hidden = true;
        detailTr.innerHTML = "<td colspan='6' class='detail-cell'>" + detalheClienteHtml(item) + "</td>";
        body.appendChild(detailTr);
      });
    }

    function clienteNomeHtml(item) {
      const tagClass = cadastroTagClass_(item.status_cadastro);
      const tag = item.status_cadastro
        ? " <span class='" + tagClass + "'>" + escapeHtml(item.status_cadastro) + "</span>"
        : "";
      return "<span class='client-name'><strong>" + escapeHtml(item.cliente) + "</strong>" + tag + "</span>";
    }

    function cadastroTagClass_(status) {
      if (status === "SUSPENSO")  return "cadastro-tag cadastro-suspended";
      if (status === "CANCELADO") return "cadastro-tag cadastro-cancelled";
      if (status === "PROTESTADO") return "cadastro-tag cadastro-protested";
      if (status === "PERMUTA")         return "cadastro-tag cadastro-permuta";
      if (status === "DESCONSIDERADO")  return "cadastro-tag cadastro-desconsiderado";
      return "cadastro-tag";
    }

    function statusClienteHtml(item) {
      const status = item.status_contato || "";
      const observacao = item.observacao_cliente || "";
      const dataAgendamento = item.data_agendamento_cliente || "";
      const badgeClass = statusContatoClass_(status);
      const statusHtml = status
        ? "<span class='" + badgeClass + "'>" + escapeHtml(status) + "</span>"
        : "<span class='muted'>—</span>";
      const dateHtml = (status === "AGENDADO" && dataAgendamento)
        ? "<span class='status-note'>" + formatDateBR(dataAgendamento) + "</span>"
        : "";
      const obsHtml = observacao ? "<span class='status-note'>" + escapeHtml(observacao) + "</span>" : "";
      return statusHtml + dateHtml + obsHtml;
    }

    function statusContatoClass_(status) {
      if (status === "EM CONTATO") return "status-badge status-contact";
      if (status === "AGENDADO")   return "status-badge status-scheduled";
      return "status-badge status-open";
    }
    function pillClass_(status) {
      if (!status || status === "VENCIDO") return "pill pill-vencido";
      if (status === "EM ABERTO")          return "pill pill-aberto";
      if (status === "PARCIAL")            return "pill pill-parcial";
      if (status === "RECEBIDO")           return "pill pill-recebido";
      return "pill pill-vencido";
    }

    function formatDateBR(iso) {
      if (!iso) return "";
      // Se vier como Date object do GAS (improvável pós-fix servidor, mas defensivo)
      var s = (iso instanceof Date)
        ? (iso.getFullYear() + "-" + ("0"+(iso.getMonth()+1)).slice(-2) + "-" + ("0"+iso.getDate()).slice(-2))
        : String(iso);
      var parts = s.substring(0, 10).split("-");
      if (parts.length !== 3 || parts[0].length !== 4) return s;
      return parts[2] + "/" + parts[1] + "/" + parts[0];
    }

    function ordenarInadimplentes(key) {
      if (sortState.key === key) {
        sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
      } else {
        sortState.key = key;
        sortState.dir = key === "cliente" ? "asc" : "desc";
      }

      aplicarOrdenacaoInadimplentes();
      renderInadimplentes(inadimplentesView);
    }

    function aplicarOrdenacaoInadimplentes() {
      const dir = sortState.dir === "asc" ? 1 : -1;
      inadimplentesView.sort(function (a, b) {
        if (sortState.key === "cliente") {
          return String(a.cliente || "").localeCompare(String(b.cliente || ""), "pt-BR") * dir;
        }

        const left = Number(a[sortState.key] || 0);
        const right = Number(b[sortState.key] || 0);
        if (left !== right) return (left - right) * dir;
        return String(a.cliente || "").localeCompare(String(b.cliente || ""), "pt-BR");
      });
    }

    function atualizarMarcadoresOrdenacao() {
      ["cliente", "duplicatas_vencidas", "valor_total"].forEach(function (key) {
        const el = document.getElementById("sort-" + key);
        if (!el) return;
        el.textContent = sortState.key === key ? (sortState.dir === "asc" ? "^" : "v") : "";
      });
    }

    function toggleDetalheCliente(item) {
      const body = document.getElementById("inadimplentes-body");
      const target = body.querySelector('tr[data-detail-for="' + cssEscape(item.id) + '"]');
      if (!target) return;

      const willOpen = target.hidden;
      Array.prototype.forEach.call(body.querySelectorAll("tr.expanded-row"), function (row) {
        row.hidden = true;
      });
      target.hidden = !willOpen;
    }

    function detalheClienteHtml(item) {
      const duplicatas = item.duplicatas || [];
      const linhas = duplicatas.map(function (dup) {
        const agrupado = dup.itens_agrupados > 1 ? "<br><span class='muted'>" + dup.itens_agrupados + " itens agrupados</span>" : "";
        return "<tr>" +
          "<td><strong>" + escapeHtml(dup.numero || "Sem numero") + "</strong>" + agrupado + "</td>" +
          "<td><span class='" + pillClass_(dup.status_cobranca) + "'>" + escapeHtml(dup.status_cobranca || "VENCIDO") + "</span></td>" +
          "<td>" + escapeHtml(formatDateBR(dup.vencimento)) + "</td>" +
          "<td class='num'>" + (dup.dias_atraso || 0) + " dias</td>" +
          "<td>" + escapeHtml(dup.categoria) + "</td>" +
          "<td class='num'><strong>" + moeda.format(dup.valor_a_receber || 0) + "</strong></td>" +
        "</tr>";
      }).join("");

      return "<div class='inline-detail'>" +
        "<div class='table-wrap'><table class='detail-table'>" +
          "<thead><tr>" +
            "<th>Numero</th>" +
            "<th>Status</th>" +
            "<th>Vencimento</th>" +
            "<th class='num'>Atraso</th>" +
            "<th>Categoria</th>" +
            "<th class='num'>A receber</th>" +
          "</tr></thead>" +
          "<tbody>" + linhas + "</tbody>" +
        "</table></div>" +
      "</div>";
    }

    function copiarResumoCliente(id, event) {
      if (event && event.stopPropagation) event.stopPropagation();
      if (!dashboardData) return;
      const item = (dashboardData.inadimplentes || []).filter(function (cliente) {
        return cliente.id === id;
      })[0];
      if (!item) return;

      const texto = [
        "Cliente: " + item.cliente,
        "Documento: " + item.cnpj_cpf,
        "Duplicatas vencidas: " + item.duplicatas_vencidas,
        "Valor total: " + moeda.format(item.valor_total || 0),
        "Detalhes:",
        (item.duplicatas || []).map(function (dup) {
          const agrupado = dup.itens_agrupados > 1 ? " | " + dup.itens_agrupados + " itens agrupados" : "";
          const categoria = dup.categoria ? " | " + dup.categoria : "";
          return "- " + (dup.numero || "Sem numero") + " | venc. " + formatDateBR(dup.vencimento) + categoria + agrupado + " | " + moeda.format(dup.valor_a_receber || 0);
        }).join("\\n")
      ].join("\\n");

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(function () {
          showToast("Resumo copiado.", "ok");
        }).catch(function () {
          showToast(texto, "ok");
        });
      } else {
        showToast(texto, "ok");
      }
    }

    function abrirStatusCliente(id, event) {
      if (event && event.stopPropagation) event.stopPropagation();
      const item = encontrarClienteDashboard(id);
      if (!item) return;

      document.getElementById("status-id").value = item.id || "";
      document.getElementById("status-documento").value = item.cnpj_cpf || "";
      document.getElementById("status-cliente").textContent = (item.cliente || "") + " - " + (item.cnpj_cpf || "");
      document.getElementById("status-contato-select").value = item.status_contato || "EM ABERTO";
      document.getElementById("status-cadastro-select").value = item.status_cadastro || "";
      document.getElementById("status-data-agendamento").value = item.data_agendamento_cliente || "";
      document.getElementById("agendamento-row").style.display = (item.status_contato === "AGENDADO") ? "" : "none";
      document.getElementById("status-observacao").value = item.observacao_cliente || "";
      document.getElementById("status-modal").classList.add("open");
    }

    function fecharStatusModal() {
      document.getElementById("status-modal").classList.remove("open");
    }

    function salvarStatusCliente() {
      const id = document.getElementById("status-id").value;
      const item = encontrarClienteDashboard(id);
      if (!item) return;

      const payload = {
        cnpj_cpf: document.getElementById("status-documento").value,
        cliente: item.cliente || "",
        status_cobranca: document.getElementById("status-contato-select").value,
        status_cadastro: document.getElementById("status-cadastro-select").value,
        data_agendamento: document.getElementById("status-data-agendamento").value,
        observacao: document.getElementById("status-observacao").value
      };

      fecharStatusModal();
      showToast("Salvando...", "ok");

      google.script.run
        .withSuccessHandler(function () {
          showToast("Status atualizado.", "ok");
          carregarDashboard();
        })
        .withFailureHandler(function (erro) {
          showToast(erro && erro.message ? erro.message : String(erro), "err");
        })
        .atualizarStatusCliente(payload);
    }

    function encontrarClienteDashboard(id) {
      if (!dashboardData) return null;
      return (dashboardData.inadimplentes || []).filter(function (cliente) {
        return cliente.id === id;
      })[0] || null;
    }

    function atualizarEstadoSistema() {
      const btnPreparar = document.getElementById("btn-preparar");

      google.script.run
        .withSuccessHandler(function (estado) {
          btnPreparar.hidden = Boolean(estado && estado.preparado);
        })
        .withFailureHandler(function () {
          btnPreparar.hidden = false;
        })
        .getEstadoSistema();
    }

    function escapeHtml(value) {
      return String(value || "").replace(/[&<>"']/g, function (char) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
      });
    }

    function escapeAttr(value) {
      return escapeHtml(value).replace(/"/g, "&quot;");
    }

    function formatDateBR(value) {
      const text = String(value || "");
      const match = text.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
      if (!match) return text;
      return match[3] + "/" + match[2] + "/" + match[1];
    }

    function cssEscape(value) {
      if (window.CSS && window.CSS.escape) return window.CSS.escape(String(value));
      return String(value).replace(/["\\\\]/g, "\\\\$&");
    }

    atualizarEstadoSistema();
    carregarDashboard();
  </script>
</body>
</html>`;
}

function importarCobrancasDaAbaPadrao() {
  return importarCobrancasDaAba(SHEETS.IMPORTACAO, SHEETS.IMPORTACAO);
}

function importarCobrancasDaAbaAtiva() {
  const sheet = SpreadsheetApp.getActiveSheet();
  return importarCobrancasDaAba(sheet.getName(), sheet.getName());
}

function importarCobrancasDaAba(nomeAbaOrigem, origemArquivo) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    setupSistemaCobrancas();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const origem = ss.getSheetByName(nomeAbaOrigem);
    if (!origem) throw new Error("Aba de origem nao encontrada: " + nomeAbaOrigem);

    const resultado = importarCobrancasDeSheet_(origem, origemArquivo || nomeAbaOrigem);
    const mensagem = montarResumoImportacao_(resultado);

    SpreadsheetApp.getActive().toast(mensagem, "Importacao concluida", 8);
    Logger.log(mensagem);
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

function importarXlsxDoDrive(fileId) {
  if (typeof Drive === "undefined" || !Drive.Files) {
    throw new Error(getDriveServiceError_());
  }

  const arquivo = Drive.Files.get(fileId);
  const convertido = Drive.Files.copy({
    title: "[TEMP] Importacao cobrancas - " + new Date().toISOString(),
    mimeType: MimeType.GOOGLE_SHEETS
  }, fileId, { convert: true });

  try {
    const tempSs = SpreadsheetApp.openById(convertido.id);
    const primeiraAba = tempSs.getSheets()[0];
    const resultado = importarCobrancasDeSheet_(primeiraAba, arquivo.title || fileId);
    Logger.log(montarResumoImportacao_(resultado));
    return resultado;
  } finally {
    DriveApp.getFileById(convertido.id).setTrashed(true);
  }
}

function importarArquivoExcelUpload(payload) {
  if (!payload || !payload.base64) {
    throw new Error("Arquivo Excel nao recebido.");
  }

  const filename = payload.filename || "cobrancas.xlsx";
  if (!/\.xlsx$/i.test(filename)) {
    throw new Error("Formato nao suportado. Envie um arquivo .xlsx.");
  }

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    setupSistemaCobrancas();

    const workbook = lerXlsxUpload_(payload.base64, filename);
    const resultado = importarCobrancasDeValues_(workbook.values, workbook.sheetName, filename);
    Logger.log(montarResumoImportacao_(resultado));
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

function atualizarStatusCliente(payload) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    setupSistemaCobrancas();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEETS.CLIENTES);
    const documento = normalizeDocumento_(payload && payload.cnpj_cpf);
    const cliente = normalizeText_(payload && payload.cliente);
    const status = normalizarStatusCliente_(payload && payload.status_cobranca);
    const statusCadastro = normalizarStatusCadastro_(payload && payload.status_cadastro);
    const dataAgendamento = (status === "AGENDADO") ? (payload && payload.data_agendamento || "") : "";
    const observacao = normalizeText_(payload && payload.observacao);
    const nowText = formatDateTime_(new Date());

    if (!documento) {
      throw new Error("Nao foi possivel atualizar o status: cliente sem CNPJ/CPF.");
    }

    const base = carregarClientes_(sheet);
    const existente = base.porDocumento[documento];

    if (existente && existente.row) {
      const atual = existente.obj;
      const merged = {
        cnpj_cpf: documento,
        cliente: cliente || atual.cliente || "",
        status_cobranca: status,
        status_cadastro: statusCadastro,
        data_agendamento: dataAgendamento,
        tipo_status: "CONTATO",
        responsavel: atual.responsavel || "",
        observacao: observacao,
        data_primeira_importacao: atual.data_primeira_importacao || nowText,
        data_ultima_importacao: nowText,
        origem_arquivo: atual.origem_arquivo || "WEB APP",
        ativo_na_ultima_importacao: atual.ativo_na_ultima_importacao || "SIM"
      };

      sheet.getRange(existente.row, 1, 1, CLIENT_HEADERS.length).setValues([toClientRow_(merged)]);
      return merged;
    }

    const novo = {
      cnpj_cpf: documento,
      cliente: cliente,
      status_cobranca: status,
      status_cadastro: statusCadastro,
      data_agendamento: dataAgendamento,
      tipo_status: "CONTATO",
      responsavel: "",
      observacao: observacao,
      data_primeira_importacao: nowText,
      data_ultima_importacao: nowText,
      origem_arquivo: "WEB APP",
      ativo_na_ultima_importacao: "SIM"
    };

    sheet.getRange(sheet.getLastRow() + 1, 1, 1, CLIENT_HEADERS.length).setValues([toClientRow_(novo)]);
    return novo;
  } finally {
    lock.releaseLock();
  }
}

function importarArquivoExcelUploadViaDrive_(payload) {
  if (typeof Drive === "undefined" || !Drive.Files) {
    throw new Error(getDriveServiceError_());
  }

  if (!payload || !payload.base64) {
    throw new Error("Arquivo Excel nao recebido.");
  }

  const filename = payload.filename || "cobrancas.xlsx";
  const mimeType = payload.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const bytes = Utilities.base64Decode(payload.base64);
  const blob = Utilities.newBlob(bytes, mimeType, filename);
  const convertido = converterExcelUploadParaSheet_(blob, filename);

  try {
    const tempSs = SpreadsheetApp.openById(convertido.id);
    const primeiraAba = tempSs.getSheets()[0];
    const resultado = importarCobrancasDeSheet_(primeiraAba, filename);
    Logger.log(montarResumoImportacao_(resultado));
    return resultado;
  } finally {
    DriveApp.getFileById(convertido.id).setTrashed(true);
  }
}

function lerXlsxUpload_(base64, filename) {
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(
    bytes,
    "application/zip",
    filename
  );
  const arquivos = Utilities.unzip(blob);
  const zip = {};

  arquivos.forEach(function (arquivo) {
    zip[normalizarZipPath_(arquivo.getName())] = arquivo.getDataAsString("UTF-8");
  });

  if (!zip["xl/workbook.xml"]) {
    throw new Error("Arquivo .xlsx invalido: workbook.xml nao encontrado.");
  }

  const sharedStrings = lerSharedStringsXlsx_(zip["xl/sharedStrings.xml"]);
  const sheetInfo = obterPrimeiraAbaXlsx_(zip);
  const sheetXml = zip[sheetInfo.path];

  if (!sheetXml) {
    throw new Error("Arquivo .xlsx invalido: primeira aba nao encontrada em " + sheetInfo.path + ".");
  }

  return {
    sheetName: sheetInfo.name,
    values: lerValoresSheetXlsx_(sheetXml, sharedStrings)
  };
}

function normalizarZipPath_(path) {
  return String(path || "").replace(/^\/+/, "").replace(/\\/g, "/");
}

function lerSharedStringsXlsx_(xml) {
  if (!xml) return [];

  const doc = XmlService.parse(xml);
  const root = doc.getRootElement();
  const ns = root.getNamespace();

  return root.getChildren("si", ns).map(function (si) {
    return coletarTextoXml_(si);
  });
}

function obterPrimeiraAbaXlsx_(zip) {
  const workbook = XmlService.parse(zip["xl/workbook.xml"]).getRootElement();
  const ns = workbook.getNamespace();
  const nsRelOffice = XmlService.getNamespace("r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships");
  const sheets = workbook.getChild("sheets", ns).getChildren("sheet", ns);

  if (!sheets.length) {
    throw new Error("Arquivo .xlsx invalido: nenhuma aba encontrada.");
  }

  const firstSheet = sheets[0];
  const relId = firstSheet.getAttribute("id", nsRelOffice).getValue();
  const sheetName = firstSheet.getAttribute("name").getValue();
  const relsXml = zip["xl/_rels/workbook.xml.rels"];

  if (!relsXml) {
    throw new Error("Arquivo .xlsx invalido: relacoes do workbook nao encontradas.");
  }

  const rels = XmlService.parse(relsXml).getRootElement();
  const nsRelPackage = rels.getNamespace();
  const relationship = rels.getChildren("Relationship", nsRelPackage).filter(function (rel) {
    return rel.getAttribute("Id").getValue() === relId;
  })[0];

  if (!relationship) {
    throw new Error("Arquivo .xlsx invalido: relacao da primeira aba nao encontrada.");
  }

  return {
    name: sheetName,
    path: resolverXlsxTargetPath_(relationship.getAttribute("Target").getValue())
  };
}

function resolverXlsxTargetPath_(target) {
  let path = normalizarZipPath_(target);

  if (path.indexOf("xl/") === 0) return path;
  if (path.indexOf("/") === 0) return normalizarZipPath_(path);

  return "xl/" + path;
}

function lerValoresSheetXlsx_(xml, sharedStrings) {
  const sheet = XmlService.parse(xml).getRootElement();
  const ns = sheet.getNamespace();
  const sheetData = sheet.getChild("sheetData", ns);

  if (!sheetData) return [];

  return sheetData.getChildren("row", ns).map(function (row) {
    const valuesByIndex = {};
    let maxIndex = -1;
    let sequentialIndex = 0;

    row.getChildren("c", ns).forEach(function (cell) {
      const refAttr = cell.getAttribute("r");
      const colIndex = refAttr ? colunaXlsxParaIndice_(refAttr.getValue()) : sequentialIndex;
      valuesByIndex[colIndex] = valorCelulaXlsx_(cell, ns, sharedStrings);
      maxIndex = Math.max(maxIndex, colIndex);
      sequentialIndex = colIndex + 1;
    });

    const rowValues = [];
    for (let i = 0; i <= maxIndex; i += 1) {
      rowValues.push(valuesByIndex[i] === undefined ? "" : valuesByIndex[i]);
    }

    return rowValues;
  });
}

function valorCelulaXlsx_(cell, ns, sharedStrings) {
  const typeAttr = cell.getAttribute("t");
  const type = typeAttr ? typeAttr.getValue() : "";

  if (type === "inlineStr") {
    const inline = cell.getChild("is", ns);
    return inline ? coletarTextoXml_(inline) : "";
  }

  const valueEl = cell.getChild("v", ns);
  const raw = valueEl ? valueEl.getText() : "";

  if (type === "s") {
    return sharedStrings[Number(raw)] || "";
  }

  if (type === "b") {
    return raw === "1";
  }

  if (raw !== "" && !isNaN(Number(raw))) {
    return Number(raw);
  }

  return raw;
}

function colunaXlsxParaIndice_(cellRef) {
  const letters = String(cellRef || "").match(/^[A-Z]+/i);
  const col = letters ? letters[0].toUpperCase() : "A";
  let index = 0;

  for (let i = 0; i < col.length; i += 1) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }

  return index - 1;
}

function coletarTextoXml_(element) {
  let text = element.getName() === "t" ? (element.getText() || "") : "";

  element.getChildren().forEach(function (child) {
    text += coletarTextoXml_(child);
  });

  return text;
}

function converterExcelUploadParaSheet_(blob, filename) {
  const title = "[TEMP] Importacao cobrancas - " + filename + " - " + new Date().toISOString();

  if (Drive.Files.create) {
    return Drive.Files.create({
      name: title,
      mimeType: MimeType.GOOGLE_SHEETS
    }, blob, { fields: "id,name" });
  }

  if (Drive.Files.insert) {
    return Drive.Files.insert({
      title: title,
      mimeType: MimeType.GOOGLE_SHEETS
    }, blob, { convert: true });
  }

  throw new Error("Drive API avancado nao possui metodo de criacao/conversao disponivel.");
}

function getDriveServiceError_() {
  return [
    "Para importar Excel diretamente, ative o servico avancado do Google Drive no Apps Script.",
    "No editor: Servicos > + > Drive API > Adicionar.",
    "Tambem confirme o Google Cloud associado com a Drive API ativada."
  ].join(" ");
}

function importarCobrancasDeSheet_(origemSheet, origemArquivo) {
  return importarCobrancasDeValues_(
    origemSheet.getDataRange().getValues(),
    origemSheet.getName(),
    origemArquivo
  );
}

function importarCobrancasDeValues_(values, abaOrigem, origemArquivo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const baseSheet = ss.getSheetByName(SHEETS.BASE);
  const duplicidadesSheet = ss.getSheetByName(SHEETS.DUPLICIDADES);
  const clientesSheet = ss.getSheetByName(SHEETS.CLIENTES);
  const logsSheet = ss.getSheetByName(SHEETS.LOGS);

  const importacao = lerRegistrosOrigem_(values, abaOrigem);
  const base = carregarBase_(baseSheet);
  const now = new Date();
  const nowText = formatDateTime_(now);

  const resumo = {
    versao: APP_VERSION,
    origem_arquivo: origemArquivo,
    aba_origem: abaOrigem,
    registros_lidos: importacao.registros.length,
    ja_existiam: 0,
    atualizados: 0,
    novas_cobrancas: 0,
    possiveis_duplicidades: 0,
    ignorados: importacao.ignorados,
    removidos: 0,
    observacao: ""
  };

  const novasLinhas = [];
  const atualizacoes = [];
  const duplicidades = [];
  const hashesImportadas = {};

  importacao.registros.forEach(function (registro) {
    registro.hash_identificacao = gerarHashIdentificacao_(registro);
    registro.hash_conteudo = gerarHashConteudo_(registro);
    hashesImportadas[registro.hash_identificacao] = true;

    const existente = base.porHash[registro.hash_identificacao];

    if (existente) {
      resumo.ja_existiam += 1;

      if (!existente.row) {
        if (existente.obj.hash_conteudo !== registro.hash_conteudo) {
          duplicidades.push(montarLinhaDuplicidade_(existente, registro, nowText));
          resumo.possiveis_duplicidades += 1;
        }
        return;
      }

      if (existente.obj.hash_conteudo !== registro.hash_conteudo) {
        resumo.atualizados += 1;
        atualizacoes.push(montarAtualizacao_(existente, registro, origemArquivo, nowText));
      } else {
        atualizacoes.push(montarAtualizacaoTecnica_(existente, origemArquivo, nowText));
      }

      return;
    }

    const parecidos = encontrarPossiveisDuplicidades_(registro, base.lista);
    if (parecidos.length) {
      parecidos.forEach(function (item) {
        duplicidades.push(montarLinhaDuplicidade_(item, registro, nowText));
      });
      resumo.possiveis_duplicidades += parecidos.length;
    }

    registro.id_interno = Utilities.getUuid();
    registro.data_primeira_importacao = nowText;
    registro.data_ultima_importacao = nowText;
    registro.origem_arquivo = origemArquivo;
    registro.ativo_na_ultima_importacao = "SIM";

    novasLinhas.push(toBaseRow_(registro));
    base.lista.push({ row: null, obj: registro });
    base.porHash[registro.hash_identificacao] = { row: null, obj: registro };
    resumo.novas_cobrancas += 1;
  });

  const rowsParaRemover = [];
  if (importacao.registros.length) {
    base.lista.forEach(function (item) {
      const hash = item.obj.hash_identificacao;
      if (item.row && hash && !hashesImportadas[hash]) {
        rowsParaRemover.push(item.row);
      }
    });
  }

  if (atualizacoes.length) {
    atualizacoes.forEach(function (update) {
      baseSheet.getRange(update.row, 1, 1, BASE_HEADERS.length).setValues([update.values]);
    });
  }

  if (novasLinhas.length) {
    baseSheet.getRange(baseSheet.getLastRow() + 1, 1, novasLinhas.length, BASE_HEADERS.length).setValues(novasLinhas);
  }

  if (duplicidades.length) {
    duplicidadesSheet.getRange(duplicidadesSheet.getLastRow() + 1, 1, duplicidades.length, DUPLICIDADE_HEADERS.length).setValues(duplicidades);
  }

  if (rowsParaRemover.length) {
    resumo.removidos = rowsParaRemover.length;
    // Excluir de baixo para cima para não deslocar índices
    rowsParaRemover.sort(function (a, b) { return b - a; });
    rowsParaRemover.forEach(function (row) {
      baseSheet.deleteRow(row);
    });
  }

  sincronizarClientes_(clientesSheet, importacao.registros, origemArquivo, nowText);

  logsSheet.appendRow([
    nowText,
    APP_VERSION,
    origemArquivo,
    abaOrigem,
    resumo.registros_lidos,
    resumo.ja_existiam,
    resumo.atualizados,
    resumo.novas_cobrancas,
    resumo.possiveis_duplicidades,
    resumo.ignorados,
    resumo.observacao
  ]);

  return resumo;
}

function lerRegistrosOrigem_(values, nomeOrigem) {
  if (!values.length) return { registros: [], ignorados: 0 };

  const headerInfo = detectarCabecalho_(values);
  if (!headerInfo) {
    throw new Error(
      "Nao foi possivel detectar o cabecalho da origem " + nomeOrigem +
      ". Use o botao Importar Excel no Web App ou informe uma aba com cabecalhos como CNPJ/CPF, Vencimento e Valor da Conta."
    );
  }

  const registros = [];
  let ignorados = 0;

  for (let r = headerInfo.rowIndex + 1; r < values.length; r += 1) {
    const row = values[r];
    const registro = normalizarRegistroOrigem_(row, headerInfo.map);

    if (!linhaValidaImportacao_(registro)) {
      ignorados += 1;
      continue;
    }

    registro.status_cobranca = registro.status_cobranca || calcularStatusCobranca_(registro);
    registros.push(registro);
  }

  return { registros: registros, ignorados: ignorados };
}

function detectarCabecalho_(values) {
  for (let r = 0; r < Math.min(values.length, 20); r += 1) {
    const normalized = values[r].map(function (value) {
      return normalizeHeader_(value);
    });

    const temDocumento = normalized.indexOf("CNPJ/CPF") >= 0 || normalized.indexOf("CPF/CNPJ") >= 0;
    const temVencimento = normalized.indexOf("VENCIMENTO") >= 0 || normalized.indexOf("DATA VENCIMENTO") >= 0;
    const temValor = normalized.indexOf("VALOR DA CONTA") >= 0 || normalized.indexOf("VALOR") >= 0;

    if (temDocumento && temVencimento && temValor) {
      return { rowIndex: r, map: mapearColunas_(normalized) };
    }
  }

  return null;
}

function mapearColunas_(headers) {
  const map = {};

  Object.keys(FIELD_ALIASES).forEach(function (field) {
    const aliases = FIELD_ALIASES[field].map(normalizeHeader_);
    for (let a = 0; a < aliases.length; a += 1) {
      for (let i = 0; i < headers.length; i += 1) {
        if (headers[i] === aliases[a]) {
          map[field] = i;
          return;
        }
      }
    }
  });

  return map;
}

function normalizarRegistroOrigem_(row, map) {
  const registro = {};

  Object.keys(FIELD_ALIASES).forEach(function (field) {
    const idx = map[field];
    const raw = idx === undefined ? "" : row[idx];

    if (field === "cnpj_cpf") {
      registro[field] = normalizeDocumento_(raw);
    } else if (field === "emissao" || field === "vencimento") {
      registro[field] = normalizeDate_(raw);
    } else if (field.indexOf("valor_") === 0) {
      registro[field] = normalizeMoney_(raw);
    } else {
      registro[field] = normalizeText_(raw);
    }
  });

  MANUAL_FIELDS.forEach(function (field) {
    registro[field] = "";
  });

  return registro;
}

function linhaValidaImportacao_(registro) {
  if (!registro.cnpj_cpf || !registro.vencimento || !registro.valor_conta) return false;

  const hasIdentity = HASH_IDENTIFICACAO_FIELDS.some(function (field) {
    return Boolean(registro[field]);
  });

  return hasIdentity;
}

function carregarBase_(sheet) {
  const values = sheet.getDataRange().getValues();
  const lista = [];
  const porHash = {};

  if (values.length <= 1) return { lista: lista, porHash: porHash };

  for (let r = 1; r < values.length; r += 1) {
    const row = values[r];
    if (isBlankRow_(row)) continue;

    const obj = normalizarCobrancaBase_(rowToObject_(row, BASE_HEADERS));
    const item = { row: r + 1, obj: obj };
    lista.push(item);

    if (obj.hash_identificacao) {
      porHash[obj.hash_identificacao] = item;
    }
  }

  return { lista: lista, porHash: porHash };
}

function sincronizarClientes_(sheet, registros, origemArquivo, nowText) {
  const base = carregarClientes_(sheet);
  const vistos = {};
  const novosPorDocumento = {};
  const atualizacoes = [];

  registros.forEach(function (registro) {
    const documento = normalizeDocumento_(registro.cnpj_cpf);
    if (!documento) return;

    vistos[documento] = true;

    const existente = base.porDocumento[documento];
    if (existente && existente.row) {
      const atual = existente.obj;
      const merged = {
        cnpj_cpf: documento,
        cliente: registro.cliente || atual.cliente || "",
        status_cobranca: normalizarStatusCliente_(atual.status_cobranca),
        status_cadastro: normalizarStatusCadastro_(atual.status_cadastro),
        data_agendamento: atual.data_agendamento || "",
        tipo_status: "CONTATO",
        responsavel: atual.responsavel || "",
        observacao: atual.observacao || "",
        data_primeira_importacao: atual.data_primeira_importacao || nowText,
        data_ultima_importacao: nowText,
        origem_arquivo: origemArquivo,
        ativo_na_ultima_importacao: "SIM"
      };

      atualizacoes.push({ row: existente.row, values: toClientRow_(merged) });
      return;
    }

    if (!novosPorDocumento[documento]) {
      novosPorDocumento[documento] = {
        cnpj_cpf: documento,
        cliente: registro.cliente || "",
        status_cobranca: STATUS_CLIENTE_PADRAO,
        status_cadastro: "",
        data_agendamento: "",
        tipo_status: "CONTATO",
        responsavel: "",
        observacao: "",
        data_primeira_importacao: nowText,
        data_ultima_importacao: nowText,
        origem_arquivo: origemArquivo,
        ativo_na_ultima_importacao: "SIM"
      };
    } else if (registro.cliente) {
      novosPorDocumento[documento].cliente = registro.cliente;
    }
  });

  if (registros.length) {
    base.lista.forEach(function (item) {
      const documento = item.obj.cnpj_cpf;
      if (item.row && documento && !vistos[documento] && item.obj.ativo_na_ultima_importacao !== "NAO") {
        const updated = {
          cnpj_cpf: documento,
          cliente: item.obj.cliente || "",
          status_cobranca: normalizarStatusCliente_(item.obj.status_cobranca),
          status_cadastro: normalizarStatusCadastro_(item.obj.status_cadastro),
          data_agendamento: item.obj.data_agendamento || "",
          tipo_status: "CONTATO",
          responsavel: item.obj.responsavel || "",
          observacao: item.obj.observacao || "",
          data_primeira_importacao: item.obj.data_primeira_importacao || "",
          data_ultima_importacao: nowText,
          origem_arquivo: item.obj.origem_arquivo || origemArquivo,
          ativo_na_ultima_importacao: "NAO"
        };
        atualizacoes.push({ row: item.row, values: toClientRow_(updated) });
      }
    });
  }

  atualizacoes.forEach(function (update) {
    sheet.getRange(update.row, 1, 1, CLIENT_HEADERS.length).setValues([update.values]);
  });

  const novasLinhas = Object.keys(novosPorDocumento).map(function (documento) {
    return toClientRow_(novosPorDocumento[documento]);
  });

  if (novasLinhas.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, novasLinhas.length, CLIENT_HEADERS.length).setValues(novasLinhas);
  }
}

function carregarClientes_(sheet) {
  const values = sheet.getDataRange().getValues();
  const lista = [];
  const porDocumento = {};

  if (values.length <= 1) return { lista: lista, porDocumento: porDocumento };

  for (let r = 1; r < values.length; r += 1) {
    const row = values[r];
    if (isBlankRow_(row)) continue;

    const obj = normalizarCliente_(rowToObject_(row, CLIENT_HEADERS));
    const item = { row: r + 1, obj: obj };
    lista.push(item);

    if (obj.cnpj_cpf) {
      porDocumento[obj.cnpj_cpf] = item;
    }
  }

  return { lista: lista, porDocumento: porDocumento };
}

function normalizarCliente_(obj) {
  const normalized = Object.assign({}, obj);
  normalized.cnpj_cpf = normalizeDocumento_(normalized.cnpj_cpf);
  normalized.cliente = normalizeText_(normalized.cliente);
  normalized.status_cobranca = normalizarStatusCliente_(normalized.status_cobranca);
  normalized.status_cadastro = normalizarStatusCadastro_(normalized.status_cadastro);
  // Garantir que data_agendamento seja sempre string ISO (Sheets converte para Date)
  const da = normalized.data_agendamento;
  normalized.data_agendamento = (da instanceof Date)
    ? Utilities.formatDate(da, Session.getScriptTimeZone(), "yyyy-MM-dd")
    : (normalizeText_(da) || "");
  normalized.tipo_status = "CONTATO";
  normalized.responsavel = normalizeText_(normalized.responsavel);
  normalized.observacao = normalizeText_(normalized.observacao);
  normalized.ativo_na_ultima_importacao = normalizeText_(normalized.ativo_na_ultima_importacao);
  return normalized;
}

function normalizarStatusCliente_(status) {
  const normalized = normalizeText_(status);
  if (STATUS_CONTATO_CLIENTE.indexOf(normalized) >= 0) return normalized;
  return STATUS_CLIENTE_PADRAO;
}

function normalizarStatusCadastro_(status) {
  const normalized = normalizeText_(status);
  if (STATUS_CADASTRO_CLIENTE.indexOf(normalized) >= 0) return normalized;
  return "";
}

function statusClienteTipo_(status) {
  const normalized = normalizeText_(status);
  return STATUS_CADASTRO_CLIENTE.indexOf(normalized) >= 0 ? "CADASTRO" : "CONTATO";
}

function toClientRow_(obj) {
  return CLIENT_HEADERS.map(function (header) {
    return obj[header] === undefined ? "" : obj[header];
  });
}

function normalizarCobrancaBase_(obj) {
  const normalized = Object.assign({}, obj);

  normalized.cnpj_cpf = normalizeDocumento_(normalized.cnpj_cpf);
  normalized.emissao = normalizeDate_(normalized.emissao);
  normalized.vencimento = normalizeDate_(normalized.vencimento);
  normalized.valor_conta = normalizeMoney_(normalized.valor_conta);
  normalized.valor_recebido = normalizeMoney_(normalized.valor_recebido);
  normalized.valor_a_receber = normalizeMoney_(normalized.valor_a_receber);
  normalized.status_cobranca = normalizeText_(normalized.status_cobranca);
  normalized.ativo_na_ultima_importacao = normalizeText_(normalized.ativo_na_ultima_importacao);

  return normalized;
}

function montarAtualizacao_(existente, registro, origemArquivo, nowText) {
  const atual = existente.obj;
  const merged = {};

  BASE_HEADERS.forEach(function (field) {
    merged[field] = atual[field] || "";
  });

  HASH_CONTEUDO_FIELDS.forEach(function (field) {
    merged[field] = registro[field] || "";
  });

  merged.hash_conteudo = registro.hash_conteudo;
  merged.data_ultima_importacao = nowText;
  merged.origem_arquivo = origemArquivo;
  merged.ativo_na_ultima_importacao = "SIM";

  MANUAL_FIELDS.forEach(function (field) {
    merged[field] = atual[field] || "";
  });

  return { row: existente.row, values: toBaseRow_(merged) };
}

function montarAtualizacaoTecnica_(existente, origemArquivo, nowText) {
  const merged = {};

  BASE_HEADERS.forEach(function (field) {
    merged[field] = existente.obj[field] || "";
  });

  merged.data_ultima_importacao = nowText;
  merged.origem_arquivo = origemArquivo;
  merged.ativo_na_ultima_importacao = "SIM";

  return { row: existente.row, values: toBaseRow_(merged) };
}

function toBaseRow_(obj) {
  return BASE_HEADERS.map(function (header) {
    return obj[header] === undefined ? "" : obj[header];
  });
}

function rowToObject_(row, headers) {
  const obj = {};
  headers.forEach(function (header, idx) {
    obj[header] = row[idx] === undefined ? "" : row[idx];
  });
  return obj;
}

function gerarHashIdentificacao_(registro) {
  return sha256_(HASH_IDENTIFICACAO_FIELDS.map(function (field) {
    return registro[field] || "";
  }).join("|"));
}

function gerarHashConteudo_(registro) {
  return sha256_(HASH_CONTEUDO_FIELDS.map(function (field) {
    return registro[field] || "";
  }).join("|"));
}

function sha256_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(function (byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ("0" + value.toString(16)).slice(-2);
  }).join("");
}

function encontrarPossiveisDuplicidades_(registro, listaBase) {
  return listaBase.filter(function (item) {
    const existente = item.obj;
    if (!existente.cnpj_cpf || existente.cnpj_cpf !== registro.cnpj_cpf) return false;
    if (!existente.vencimento || !registro.vencimento || existente.vencimento !== registro.vencimento) return false;

    const mesmoNumero = camposIguaisNaoVazios_(existente.numero, registro.numero);
    const mesmoBoleto = camposIguaisNaoVazios_(existente.boleto, registro.boleto);
    const mesmaParcela = camposIguaisNaoVazios_(existente.parcela, registro.parcela);
    const mesmaCategoria = camposIguaisNaoVazios_(existente.categoria, registro.categoria);
    const mesmoValor = camposIguaisNaoVazios_(existente.valor_conta, registro.valor_conta);
    const mesmaEmissao = camposIguaisNaoVazios_(existente.emissao, registro.emissao);

    return (
      mesmoNumero ||
      mesmoBoleto ||
      (mesmaParcela && mesmaCategoria) ||
      (mesmaCategoria && mesmoValor) ||
      (mesmaEmissao && (mesmaCategoria || mesmoValor))
    );
  });
}

function camposIguaisNaoVazios_(a, b) {
  return Boolean(a) && Boolean(b) && String(a) === String(b);
}

function montarLinhaDuplicidade_(existente, registro, nowText) {
  return [
    nowText,
    "POSSIVEL_DUPLICIDADE",
    existente.obj.id_interno || "",
    existente.obj.hash_identificacao || "",
    registro.hash_identificacao || "",
    registro.cliente || "",
    registro.cnpj_cpf || "",
    registro.emissao || "",
    registro.vencimento || "",
    registro.categoria || "",
    registro.parcela || "",
    registro.numero || "",
    registro.valor_conta || "",
    "Mesmo documento e vencimento, com identificadores semelhantes. Revisar antes de unir ou descartar."
  ];
}

function calcularStatusCobranca_(registro) {
  const valorRecebido = parseNumber_(registro.valor_recebido);
  const valorAReceber = parseNumber_(registro.valor_a_receber);

  if (valorAReceber <= 0) return "RECEBIDO";
  if (valorRecebido > 0) return "PARCIAL";

  const vencimento = parseIsoDate_(registro.vencimento);
  const hoje = parseIsoDate_(formatDate_(new Date()));

  if (vencimento && vencimento.getTime() < hoje.getTime()) return "VENCIDO";
  return "EM ABERTO";
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);

  if (headers && headers.length) {
    const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const needsHeader = headers.some(function (header, idx) {
      return current[idx] !== header;
    });

    if (needsHeader) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  return sheet;
}

function sheetHasHeaders_(ss, name, headers) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return false;
  if (!headers || !headers.length) return true;
  if (sheet.getLastColumn() < headers.length) return false;

  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  return headers.every(function (header, idx) {
    return current[idx] === header;
  });
}

function freezeHeader_(sheet) {
  if (sheet.getMaxRows() >= 1) sheet.setFrozenRows(1);
}

function hideTechnicalColumns_(sheet) {
  sheet.hideColumns(1, 7);
}

function montarResumoImportacao_(resumo) {
  return [
    resumo.registros_lidos + " registros lidos",
    resumo.ja_existiam + " ja existiam",
    resumo.atualizados + " atualizados",
    resumo.novas_cobrancas + " novas cobrancas adicionadas",
    resumo.possiveis_duplicidades + " possiveis duplicidades encontradas",
    resumo.ignorados + " ignorados"
  ].join("\n");
}

function normalizeHeader_(value) {
  return removeAccents_(String(value || ""))
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeText_(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) return "";

  const clean = removeAccents_(text).toUpperCase();
  if (["N/D", "ND", "N.A.", "NA", "-", "--", "NULL", "NULO"].indexOf(clean) >= 0) return "";

  return text.toUpperCase();
}

function normalizeDocumento_(value) {
  return normalizeText_(value).replace(/\D+/g, "");
}

function normalizeDate_(value) {
  if (value === null || value === undefined || value === "") return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return formatDate_(value);
  }

  if (typeof value === "number") {
    return formatDate_(new Date(Math.round((value - 25569) * 86400 * 1000)));
  }

  const text = normalizeText_(value);
  if (!text) return "";

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return text;

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? "20" + br[3] : br[3];
    return [year, pad2_(br[2]), pad2_(br[1])].join("-");
  }

  return text;
}

function normalizeMoney_(value) {
  if (value === null || value === undefined || value === "") return "0.00";

  if (typeof value === "number") {
    return value.toFixed(2);
  }

  const text = normalizeText_(value);
  if (!text) return "0.00";

  let clean = text
    .replace(/[R$\s]/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (clean.indexOf(",") >= 0) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  }

  const number = Number(clean);
  return isNaN(number) ? "0.00" : number.toFixed(2);
}

function parseNumber_(value) {
  const number = Number(normalizeMoney_(value));
  return isNaN(number) ? 0 : number;
}

function parseIsoDate_(value) {
  if (!value) return null;
  const normalized = normalizeDate_(value);
  if (!normalized) return null;
  const parts = String(normalized).split("-");
  if (parts.length !== 3) return null;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return isNaN(date.getTime()) ? null : date;
}

function formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function formatDateTime_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

function pad2_(value) {
  return ("0" + value).slice(-2);
}

function removeAccents_(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isBlankRow_(row) {
  return row.every(function (value) {
    return value === "" || value === null || value === undefined;
  });
}
