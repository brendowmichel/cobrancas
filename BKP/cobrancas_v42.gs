// SISTEMA DE GESTAO DE COBRANCAS - Apps Script v42
// Base em Google Sheets com controle interno por id_interno, hash_identificacao e hash_conteudo.

const APP_VERSION = "v42";

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
  "ativo_na_ultima_importacao",
  "data_status_cadastro"
];

const STATUS_CONTATO_CLIENTE = ["EM ABERTO", "EM CONTATO", "AGENDADO", "FINALIZADO"];
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
      total_protestado: arredondar2_(inadimplentes
        .filter(function(g) { return g.status_contato === "FINALIZADO"; })
        .reduce(function(acc, g) { return acc + (g.valor_total || 0); }, 0)),
      total_vencido_ajustado: arredondar2_(inadimplentes
        .filter(function(g) {
          return g.status_contato !== "FINALIZADO" &&
                 g.status_cadastro !== "PERMUTA" && g.status_cadastro !== "DESCONSIDERADO";
        })
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
  grupo.data_status_cadastro_cliente = clienteCadastro ? clienteCadastro.data_status_cadastro || "" : "";
  grupo.observacao_cliente = clienteCadastro ? clienteCadastro.observacao || "" : "";
  grupo.responsavel_cliente = clienteCadastro ? clienteCadastro.responsavel || "" : "";
}

function kpisVazios_() {
  return {
    total_aberto: 0,
    total_vencido: 0,
    total_protestado: 0,
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,400;8..144,500;8..144,600;8..144,700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" rel="stylesheet">
  <style type="text/tailwindcss">
    :root {
      /* Material 3 — esquema claro, base branca, primaria Google Blue */
      --md-primary:#0b57d0; --md-on-primary:#ffffff;
      --md-primary-container:#d3e3fd; --md-on-primary-container:#041e49;
      --md-secondary:#565f71; --md-on-secondary:#ffffff;
      --md-secondary-container:#dae2f9; --md-on-secondary-container:#131c2b;
      --md-tertiary:#6b5778; --md-tertiary-container:#f2daff; --md-on-tertiary-container:#270d33;
      --md-error:#ba1a1a; --md-on-error:#ffffff;
      --md-error-container:#ffdad6; --md-on-error-container:#410002;
      --md-success:#146c43; --md-success-container:#c4f0d0; --md-on-success-container:#04210f;
      --md-warning:#8a5300; --md-warning-container:#ffddb0; --md-on-warning-container:#2c1600;
      --md-surface:#ffffff;
      --md-surface-container-lowest:#ffffff;
      --md-surface-container-low:#f7f8fc;
      --md-surface-container:#f1f2f8;
      --md-surface-container-high:#ebecf3;
      --md-surface-container-highest:#e5e6ee;
      --md-on-surface:#1a1b20;
      --md-on-surface-variant:#44474e;
      --md-outline:#74777f;
      --md-outline-variant:#e7e8ef;
      --md-inverse-surface:#2f3036;
      --md-inverse-on-surface:#f1f0f7;
      --md-inverse-primary:#a8c7fa;
      --md-shadow-1:0 1px 2px rgba(16,24,40,.05),0 1px 3px rgba(16,24,40,.08);
      --md-shadow-2:0 1px 2px rgba(16,24,40,.06),0 4px 10px rgba(16,24,40,.08);
      --md-shadow-3:0 4px 8px rgba(16,24,40,.10),0 8px 24px rgba(16,24,40,.12);
    }
    body { font-family:'Roboto Flex','Roboto',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif; }
    .md-icon {
      font-family:'Material Symbols Rounded'; font-weight:normal; font-style:normal;
      line-height:1; letter-spacing:normal; text-transform:none; display:inline-block;
      white-space:nowrap; -webkit-font-feature-settings:'liga'; -webkit-font-smoothing:antialiased;
      vertical-align:middle; flex-shrink:0;
    }

    @layer components {
      /* === Botoes Material 3 (pill, state layer) ============= */
      .btn-primary {
        position:relative; overflow:hidden;
        @apply inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all cursor-pointer px-6 text-sm leading-none;
        height:40px; background:var(--md-primary); color:var(--md-on-primary); border:0;
      }
      .btn-primary:hover { box-shadow:var(--md-shadow-1); filter:brightness(1.05); }
      .btn-primary:active { filter:brightness(.95); }

      .btn-secondary, .secondary {
        position:relative; overflow:hidden;
        @apply inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all cursor-pointer px-6 text-sm leading-none;
        height:40px; background:var(--md-secondary-container); color:var(--md-on-secondary-container); border:0;
      }
      .btn-secondary:hover, .secondary:hover { box-shadow:var(--md-shadow-1); filter:brightness(.98); }

      .secondary.small {
        @apply px-4 text-xs font-medium rounded-full;
        height:32px; background:transparent; color:var(--md-primary);
        border:1px solid var(--md-outline-variant);
      }
      .secondary.small:hover { background:color-mix(in srgb, var(--md-primary) 8%, transparent); box-shadow:none; filter:none; }

      /* === Sort buttons ===================================== */
      .sort-btn {
        @apply inline-flex items-center gap-1 bg-transparent p-0 text-xs font-medium uppercase cursor-pointer transition-colors whitespace-nowrap;
        letter-spacing:.06em; color:var(--md-on-surface-variant); border:0;
      }
      .sort-btn:hover { color:var(--md-primary); }
      .sort-mark { @apply inline-block w-3 text-center font-bold; color:var(--md-primary); }

      /* === Tabela =========================================== */
      .main-table tbody td {
        @apply px-5 py-3.5 text-sm align-middle;
        color:var(--md-on-surface); border-bottom:1px solid var(--md-outline-variant);
      }
      .main-table tbody tr:last-child td { border-bottom:0; }
      .row-ag-vencido { background:var(--md-error-container); }
      .row-ag-vencido:hover { background:color-mix(in srgb, var(--md-error) 14%, var(--md-surface)); }
      .cliente-row { position:relative; @apply cursor-pointer transition-colors; }
      .cliente-row:hover { background:color-mix(in srgb, var(--md-primary) 5%, var(--md-surface)); }
      .expanded-row { cursor:default; }
      .detail-cell { padding:0; }
      .expanded-row:not([hidden]) .inline-detail { animation:md-expand .26s cubic-bezier(.2,0,0,1); }
      .inline-detail {
        overflow-x:auto; border-left:3px solid var(--md-primary);
        background:var(--md-surface-container-low);
      }
      .detail-tbl { width:100%; border-collapse:collapse; table-layout:fixed; min-width:640px; }
      .detail-tbl thead th {
        padding:.5rem 1rem; font-size:.6875rem; font-weight:600;
        color:var(--md-on-surface-variant); text-transform:uppercase; letter-spacing:.07em;
        background:var(--md-surface-container); border-bottom:1px solid var(--md-outline-variant);
        text-align:left; white-space:nowrap;
      }
      .detail-tbl tbody tr { border-bottom:1px solid var(--md-outline-variant); }
      .detail-tbl tbody tr:last-child { border-bottom:none; }
      .detail-tbl tbody tr:hover { background:color-mix(in srgb, var(--md-primary) 6%, transparent); }
      .detail-tbl tbody td { padding:.625rem 1rem; font-size:.8125rem; color:var(--md-on-surface); vertical-align:middle; }
      .detail-tbl tfoot tr { border-top:2px solid var(--md-outline-variant); }
      .detail-tbl tfoot td { padding:.5rem 1rem; font-size:.8125rem; background:var(--md-surface-container); }

      /* === Status cell ====================================== */
      .status-cell { min-width:160px; max-width:260px; }
      .status-main { display:block; }
      .status-note {
        @apply block text-xs mt-1; color:var(--md-on-surface-variant);
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:240px;
      }

      /* === Chips de status (M3) ============================= */
      .status-badge { @apply inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium; }
      .status-open       { background:var(--md-surface-container-high); color:var(--md-on-surface-variant); }
      .status-contact    { background:var(--md-primary-container); color:var(--md-on-primary-container); }
      .status-scheduled  { background:var(--md-tertiary-container); color:var(--md-on-tertiary-container); }
      .status-finalizado { background:var(--md-success-container); color:var(--md-on-success-container); }

      .cadastro-tag { @apply inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold uppercase; }
      .cadastro-suspended      { background:var(--md-warning-container); color:var(--md-on-warning-container); }
      .cadastro-cancelled      { background:var(--md-error-container); color:var(--md-on-error-container); }
      .cadastro-protested      { background:var(--md-error-container); color:var(--md-on-error-container); }
      .cadastro-permuta        { background:#bdf2e0; color:#00382a; }
      .cadastro-desconsiderado { background:var(--md-surface-container-high); color:var(--md-on-surface-variant); }

      .pill { @apply inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium; }
      .pill-vencido  { background:var(--md-error-container); color:var(--md-on-error-container); }
      .pill-aberto   { background:var(--md-surface-container-high); color:var(--md-on-surface-variant); }
      .pill-parcial  { background:var(--md-warning-container); color:var(--md-on-warning-container); }
      .pill-recebido { background:var(--md-success-container); color:var(--md-on-success-container); }

      /* === Misc ============================================= */
      .muted { color:var(--md-on-surface-variant); }
      .num   { @apply text-right whitespace-nowrap; }
      .ok    { color:var(--md-success); }
      .err   { color:var(--md-error); }
      .warn  { color:var(--md-warning); }
      .client-name  { @apply flex items-center gap-2 flex-wrap; font-weight:600; }
      .cell-nome    { display:flex; flex-direction:column; gap:2px; }
      .cnpj-line    { @apply text-xs; color:var(--md-on-surface-variant); display:block; margin-top:1px; }
      .action-stack { @apply flex items-center gap-2 justify-end; flex-wrap:nowrap; }
      .actions      { width:170px; min-width:170px; text-align:right; }
      .version      { @apply inline-flex items-center px-3 py-1 rounded-full text-xs font-medium; background:var(--md-surface-container-high); color:var(--md-on-surface-variant); }
      .status-line  { @apply text-sm; color:var(--md-on-surface-variant); min-height:20px; }
      .legend-chip:hover { background:var(--md-surface-container-high); }

      /* === Cards M3 ========================================= */
      .md-card {
        background:var(--md-surface-container-lowest); border:1px solid rgba(116,119,127,.14);
        border-radius:16px; box-shadow:var(--md-shadow-1);
        transition:box-shadow .2s, transform .2s, border-color .2s;
      }
      .md-card-hover:hover { box-shadow:var(--md-shadow-2); transform:translateY(-1px); }

      /* === Menus flutuantes ================================= */
      .menu-popover {
        display:none; position:absolute; right:0; top:calc(100% + .625rem); z-index:100;
        background:var(--md-surface-container-lowest); border:1px solid rgba(116,119,127,.14);
        border-radius:20px; box-shadow:var(--md-shadow-3); padding:.5rem;
      }
      .menu-item {
        width:100%; min-height:44px; padding:0 .875rem; border:0; border-radius:14px;
        background:transparent; color:var(--md-on-surface); cursor:pointer;
        display:flex; align-items:center; gap:.75rem; text-align:left; font:inherit; font-size:.875rem;
      }
      .menu-item:hover { background:var(--md-surface-container); }
      .menu-item-copy { display:flex; flex-direction:column; gap:2px; }
      .menu-item-copy small { color:var(--md-on-surface-variant); font-size:.7rem; }

      /* === Progresso da importacao ========================== */
      .import-progress { display:none; gap:.5rem; }
      .import-progress.visible { display:grid; }
      .progress-track {
        width:100%; height:6px; overflow:hidden; border-radius:999px;
        background:var(--md-surface-container-highest);
      }
      .progress-bar {
        width:0; height:100%; border-radius:999px; background:var(--md-primary);
        transition:width .24s cubic-bezier(.2,0,0,1);
      }
      .progress-bar.indeterminate { width:38%; animation:md-progress 1.1s ease-in-out infinite; }
      .import-success {
        display:flex; align-items:flex-start; gap:.5rem; padding:.625rem .75rem;
        border-radius:14px; background:var(--md-success-container); color:var(--md-on-success-container);
        font-size:.75rem; line-height:1.35;
      }

      /* === Campos M3 ======================================== */
      .md-field {
        width:100%; height:48px; padding:0 1rem; font-size:.875rem;
        color:var(--md-on-surface); background:var(--md-surface-container-low);
        border:1px solid var(--md-outline-variant); border-radius:12px; outline:none;
        transition:border-color .15s, box-shadow .15s; font-family:inherit; box-sizing:border-box;
      }
      .md-field:focus { border-color:var(--md-primary); box-shadow:0 0 0 2px color-mix(in srgb, var(--md-primary) 30%, transparent); }
      .md-label { @apply block text-xs font-medium mb-1.5; color:var(--md-on-surface-variant); }

      /* === Snackbar (toast) M3 ============================== */
      .toast {
        display:grid; grid-template-columns:36px minmax(0,1fr) 28px; align-items:start; gap:.75rem;
        background:var(--md-inverse-surface); color:var(--md-inverse-on-surface);
        border-radius:18px; padding:.875rem; font-size:.8125rem; box-shadow:var(--md-shadow-3);
        animation:md-snack .28s cubic-bezier(.2,0,0,1); overflow:hidden;
      }
      .toast-icon {
        width:36px; height:36px; display:flex; align-items:center; justify-content:center;
        border-radius:12px; background:var(--md-inverse-primary); color:var(--md-on-primary-container);
      }
      .toast.ok .toast-icon { background:#c4f0d0; color:#04210f; }
      .toast.err .toast-icon { background:#ffdad6; color:#410002; }
      .toast.warn .toast-icon { background:#ffddb0; color:#2c1600; }
      .toast-title { display:block; font-weight:700; margin-bottom:3px; }
      .toast-message { white-space:pre-wrap; line-height:1.45; color:var(--md-inverse-on-surface); }
      .toast-close {
        width:28px; height:28px; display:flex; align-items:center; justify-content:center;
        border:0; border-radius:50%; background:transparent; color:inherit; cursor:pointer; padding:0;
      }
      .toast-close:hover { background:rgba(255,255,255,.12); }

      /* === Dialog M3 ======================================== */
      .modal-backdrop { @apply fixed inset-0 hidden items-center justify-center p-4 z-50; background:rgba(0,0,0,.32); }
      .modal-backdrop.open { @apply flex; }
      .modal {
        @apply w-full p-6; max-width:480px;
        background:var(--md-surface-container-high); border-radius:28px; box-shadow:var(--md-shadow-3);
        animation:md-dialog .22s cubic-bezier(.2,0,0,1);
      }
      .modal-head { @apply flex items-start justify-between gap-3 mb-5; }
      .form-grid  { @apply flex flex-col gap-4; }

      /* === Ripple =========================================== */
      .md-ripple-ink {
        position:absolute; border-radius:50%; background:currentColor; opacity:.20;
        transform:scale(0); animation:md-ripple .55s ease-out; pointer-events:none;
      }
    }

    @keyframes md-ripple { to { transform:scale(2.4); opacity:0; } }
    @keyframes md-expand { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
    @keyframes md-dialog { from { opacity:0; transform:scale(.92) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
    @keyframes md-snack  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes md-progress { 0% { transform:translateX(-110%); } 55% { transform:translateX(120%); } 100% { transform:translateX(260%); } }
  </style>
</head>
<body class="min-h-screen" style="background:var(--md-surface-container-low);color:var(--md-on-surface);-webkit-font-smoothing:antialiased">

  <main style="max-width:1280px;margin:0 auto;padding:2rem 1.5rem 3rem">

    <!-- == Header (top app bar) == -->
    <header class="flex items-center justify-between mb-8">
      <div class="flex items-center gap-3">
        <div style="width:46px;height:46px;border-radius:14px;background:var(--md-primary-container);color:var(--md-on-primary-container);display:flex;align-items:center;justify-content:center">
          <span class="md-icon" style="font-size:26px">request_quote</span>
        </div>
        <div>
          <h1 style="font-size:1.5rem;font-weight:600;letter-spacing:-.01em;margin:0;color:var(--md-on-surface)">Cobranças</h1>
          <p id="subtitulo" class="muted" style="font-size:.8125rem;margin:.15rem 0 0">Carregando dados da base...</p>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:.625rem;position:relative">
        <div style="position:relative">
          <button id="btn-report-trigger" type="button" onclick="toggleReportMenu()" class="secondary">
            <span class="md-icon" style="font-size:18px">picture_as_pdf</span>
            Relatório
            <span class="md-icon" style="font-size:18px;opacity:.7">expand_more</span>
          </button>
          <div id="report-menu" class="menu-popover" style="width:260px">
            <button type="button" class="menu-item" onclick="gerarRelatorio('resumido')">
              <span class="md-icon" style="font-size:20px;color:var(--md-primary)">summarize</span>
              <span class="menu-item-copy"><strong>Resumido</strong><small>Clientes, status, valores e observações</small></span>
            </button>
            <button type="button" class="menu-item" onclick="gerarRelatorio('detalhado')">
              <span class="md-icon" style="font-size:20px;color:var(--md-tertiary)">format_list_bulleted</span>
              <span class="menu-item-copy"><strong>Detalhado</strong><small>Inclui todas as duplicatas e parcelas</small></span>
            </button>
          </div>
        </div>
        <div style="position:relative">
          <button id="btn-import-trigger" type="button" onclick="toggleImportMenu()" class="btn-secondary">
            <span class="md-icon" style="font-size:18px">upload_file</span>
            Importar
            <span class="md-icon" style="font-size:18px;opacity:.7">expand_more</span>
          </button>
          <div id="import-menu" class="menu-popover" style="width:300px;padding:1.125rem">
            <p style="font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.08em;margin:0 0 .75rem">Importação</p>
            <div style="display:flex;flex-direction:column;gap:.75rem">
              <div>
                <label for="arquivo-excel" class="md-label">Arquivo Excel (.xlsx)</label>
                <input id="arquivo-excel" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="display:none" onchange="mostrarNomeArquivo()">
                <label for="arquivo-excel" class="secondary small" style="cursor:pointer;width:max-content"><span class="md-icon" style="font-size:16px">attach_file</span>Escolher arquivo</label>
                <span id="arquivo-nome" style="display:block;font-size:.75rem;color:var(--md-on-surface-variant);margin-top:.45rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Nenhum arquivo escolhido</span>
              </div>
              <button id="btn-importar-excel" type="button" onclick="importarArquivoExcel()" class="btn-primary" style="width:100%">
                <span class="md-icon" style="font-size:18px">upload</span><span id="btn-importar-texto">Importar Excel</span>
              </button>
              <button id="btn-preparar" type="button" onclick="prepararAbas()" class="secondary" hidden style="width:100%">Preparar abas</button>
              <div id="import-progress" class="import-progress">
                <div class="progress-track"><div id="import-progress-bar" class="progress-bar"></div></div>
                <div id="import-status" class="status-line"></div>
              </div>
            </div>
          </div>
        </div>
        <span class="version">${APP_VERSION}</span>
      </div>
    </header>

    <!-- == KPIs e Graficos == -->
    <div style="display:grid;grid-template-columns:0.6fr 0.6fr 1fr 1fr;gap:1rem;margin-bottom:1.5rem">
      <div class="md-card md-card-hover" style="padding:1.25rem">
        <span style="display:flex;align-items:center;gap:.375rem;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.08em"><span class="md-icon" style="font-size:16px;color:var(--md-error)">trending_down</span>Total vencido</span>
        <del id="kpi-vencido-original" style="display:none;font-size:.875rem;font-weight:500;color:var(--md-on-surface-variant);margin-top:.375rem">R$ 0,00</del>
        <strong id="kpi-vencido" style="display:block;font-size:1.625rem;font-weight:700;color:var(--md-error);margin-top:.25rem;font-variant-numeric:tabular-nums;letter-spacing:-.02em">R$ 0,00</strong>
      </div>
      <div class="md-card md-card-hover" style="padding:1.25rem">
        <span style="display:flex;align-items:center;gap:.375rem;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.08em"><span class="md-icon" style="font-size:16px;color:var(--md-tertiary)">gavel</span>Total protestado</span>
        <strong id="kpi-protestado" style="display:block;font-size:1.625rem;font-weight:700;color:var(--md-tertiary);margin-top:.25rem;font-variant-numeric:tabular-nums;letter-spacing:-.02em">R$ 0,00</strong>
      </div>
      <div id="grafico-contato" class="md-card" style="padding:1.25rem;min-height:90px"></div>
      <div id="grafico-cadastro" class="md-card" style="padding:1.25rem;min-height:90px"></div>
    </div>

    <!-- == Tabela principal == -->
    <div class="md-card" style="overflow:hidden">

      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--md-outline-variant)">
        <div>
          <h2 style="font-size:1.125rem;font-weight:600;color:var(--md-on-surface);margin:0;display:flex;align-items:center;gap:.5rem"><span class="md-icon" style="font-size:18px;color:var(--md-on-surface-variant)">warning</span>Inadimplentes</h2>
          <p id="lista-info" class="muted" style="font-size:.8125rem;margin:.25rem 0 0">Carregando...</p>
        </div>
        <button type="button" onclick="carregarDashboard()" class="secondary small" style="gap:.375rem"><span class="md-icon" style="font-size:16px">refresh</span>Atualizar</button>
      </div>

      <div style="padding:.75rem 1.25rem;border-bottom:1px solid var(--md-outline-variant)">
        <div style="position:relative;display:flex;align-items:center">
          <span class="md-icon" style="position:absolute;left:.875rem;font-size:20px;color:var(--md-on-surface-variant);pointer-events:none">search</span>
          <input id="filtro-cliente" type="text" placeholder="Filtrar por nome..." autocomplete="off"
            oninput="filtrarInadimplentes(this.value);document.getElementById('filtro-clear').style.display=this.value?'flex':'none'"
            class="md-field" style="height:44px;padding-left:2.75rem;padding-right:2.5rem">
          <button id="filtro-clear" type="button" onclick="limparFiltro()"
            style="display:none;position:absolute;right:.5rem;width:28px;height:28px;align-items:center;justify-content:center;border:none;background:transparent;cursor:pointer;border-radius:50%;color:var(--md-on-surface-variant);padding:0;transition:background .12s"
            onmouseover="this.style.background='var(--md-surface-container-high)'" onmouseout="this.style.background='transparent'">
            <span class="md-icon" style="font-size:18px">close</span>
          </button>
        </div>
      </div>

      <div style="overflow-x:auto">
        <table class="main-table" style="width:100%;border-collapse:collapse;min-width:900px">
          <thead>
            <tr style="border-bottom:1px solid var(--md-outline-variant);background:var(--md-surface-container-low)">
              <th style="padding:.875rem 1.25rem;text-align:left">
                <button type="button" class="sort-btn" onclick="ordenarInadimplentes('cliente')">
                  Nome <span id="sort-cliente" class="sort-mark"></span>
                </button>
              </th>
              <th style="padding:.875rem 1.25rem;text-align:left;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em;min-width:170px">Status</th>
              <th style="padding:.875rem 1.25rem;text-align:right">
                <button type="button" class="sort-btn" style="justify-content:flex-end;width:100%" onclick="ordenarInadimplentes('duplicatas_vencidas')">
                  Duplicatas <span id="sort-duplicatas_vencidas" class="sort-mark"></span>
                </button>
              </th>
              <th style="padding:.875rem 1.25rem;text-align:right">
                <button type="button" class="sort-btn" style="justify-content:flex-end;width:100%" onclick="ordenarInadimplentes('valor_total')">
                  Valor total <span id="sort-valor_total" class="sort-mark"></span>
                </button>
              </th>
              <th style="padding:.875rem 1.25rem;text-align:right;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">Maior atraso</th>
              <th class="actions" style="padding:.875rem 1.25rem;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em">Ações</th>
            </tr>
          </thead>
          <tbody id="inadimplentes-body">
            <tr><td colspan="6" class="px-5 py-10 text-center muted" style="padding:2.5rem;text-align:center">Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- == Finalizados == -->
    <div id="finalizados-section" style="display:none;margin-top:1.5rem;overflow:hidden" class="md-card">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--md-outline-variant)">
        <div>
          <h2 style="font-size:1.125rem;font-weight:600;color:var(--md-on-surface);margin:0;display:flex;align-items:center;gap:.5rem"><span class="md-icon" style="font-size:18px;color:var(--md-on-surface-variant)">gavel</span>Protestados</h2>
          <p id="finalizados-info" class="muted" style="font-size:.8125rem;margin:.25rem 0 0">—</p>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table class="main-table" style="width:100%;border-collapse:collapse;min-width:900px">
          <thead>
            <tr style="border-bottom:1px solid var(--md-outline-variant);background:var(--md-surface-container-low)">
              <th style="padding:.875rem 1.25rem;text-align:left;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em">Cliente</th>
              <th style="padding:.875rem 1.25rem;text-align:left;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em;min-width:170px">Status</th>
              <th style="padding:.875rem 1.25rem;text-align:right;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">Duplicatas</th>
              <th style="padding:.875rem 1.25rem;text-align:right;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">Total</th>
              <th style="padding:.875rem 1.25rem;text-align:right;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">Maior atraso</th>
              <th class="actions" style="padding:.875rem 1.25rem;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em">Ações</th>
            </tr>
          </thead>
          <tbody id="finalizados-body"></tbody>
        </table>
      </div>
    </div>

    <!-- == Desconsiderados == -->
    <div id="desconsiderados-section" style="display:none;margin-top:1.5rem;overflow:hidden" class="md-card">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--md-outline-variant)">
        <div>
          <h2 style="font-size:1.125rem;font-weight:600;color:var(--md-on-surface);margin:0;display:flex;align-items:center;gap:.5rem"><span class="md-icon" style="font-size:18px;color:var(--md-on-surface-variant)">do_not_disturb_on</span>Desconsiderados</h2>
          <p id="desconsiderados-info" class="muted" style="font-size:.8125rem;margin:.25rem 0 0">—</p>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table class="main-table" style="width:100%;border-collapse:collapse;min-width:900px">
          <thead>
            <tr style="border-bottom:1px solid var(--md-outline-variant);background:var(--md-surface-container-low)">
              <th style="padding:.875rem 1.25rem;text-align:left;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em">Cliente</th>
              <th style="padding:.875rem 1.25rem;text-align:left;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em;min-width:170px">Status</th>
              <th style="padding:.875rem 1.25rem;text-align:right;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">Duplicatas</th>
              <th style="padding:.875rem 1.25rem;text-align:right;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">Total</th>
              <th style="padding:.875rem 1.25rem;text-align:right;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">Maior atraso</th>
              <th class="actions" style="padding:.875rem 1.25rem;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.06em">Ações</th>
            </tr>
          </thead>
          <tbody id="desconsiderados-body"></tbody>
        </table>
      </div>
    </div>
  </main>

  <!-- == Dialog (status) == -->
  <div id="status-modal" class="modal-backdrop">
    <div class="modal">
      <div class="modal-head">
        <div>
          <h2 style="font-size:1.25rem;font-weight:600;color:var(--md-on-surface);margin:0">Atualizar status</h2>
          <p id="status-cliente" class="muted" style="font-size:.8125rem;margin:.25rem 0 0"></p>
        </div>
        <button type="button" class="secondary small" onclick="fecharStatusModal()" style="width:32px;padding:0"><span class="md-icon" style="font-size:18px">close</span></button>
      </div>
      <div class="form-grid">
        <input id="status-id" type="hidden">
        <input id="status-documento" type="hidden">
        <div>
          <label for="status-contato-select" class="md-label">Status de contato</label>
          <select id="status-contato-select" onchange="var r=document.getElementById('agendamento-row');r.style.display=(this.value==='AGENDADO')?'':'none';if(this.value!=='AGENDADO')document.getElementById('status-data-agendamento').value='';" class="md-field">
            <option value="EM ABERTO">EM ABERTO</option>
            <option value="EM CONTATO">EM CONTATO</option>
            <option value="AGENDADO">AGENDADO</option>
            <option value="FINALIZADO">FINALIZADO</option>
          </select>
        </div>
        <div id="agendamento-row" style="display:none">
          <label for="status-data-agendamento" class="md-label">Data do agendamento</label>
          <input id="status-data-agendamento" type="date" class="md-field">
        </div>
        <div>
          <label for="status-cadastro-select" class="md-label">Status de cadastro</label>
          <select id="status-cadastro-select" onchange="var cr=document.getElementById('cadastro-data-row');var mostra=(this.value==='PROTESTADO'||this.value==='DESCONSIDERADO');cr.style.display=mostra?'':'none';if(!mostra)document.getElementById('status-data-cadastro').value='';" class="md-field">
            <option value="">Nenhum</option>
            <option value="SUSPENSO">SUSPENSO</option>
            <option value="CANCELADO">CANCELADO</option>
            <option value="PROTESTADO">PROTESTADO</option>
            <option value="PERMUTA">PERMUTA</option>
            <option value="DESCONSIDERADO">DESCONSIDERADO</option>
          </select>
        </div>
        <div id="cadastro-data-row" style="display:none">
          <label for="status-data-cadastro" class="md-label">Data do protesto / desconsideração</label>
          <input id="status-data-cadastro" type="date" class="md-field">
        </div>
        <div>
          <label for="status-observacao" class="md-label">Observação</label>
          <textarea id="status-observacao" rows="3" class="md-field" style="height:auto;padding:.75rem 1rem;resize:vertical"></textarea>
        </div>
        <div style="display:flex;gap:.5rem;justify-content:flex-end;padding-top:.25rem">
          <button type="button" onclick="fecharStatusModal()" class="secondary">Cancelar</button>
          <button type="button" onclick="salvarStatusCliente()" class="btn-primary">Salvar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- == Toast / Snackbar == -->
  <div id="toast-area" style="position:fixed;right:1.25rem;bottom:1.25rem;display:flex;flex-direction:column;align-items:stretch;gap:.625rem;z-index:150;width:400px;max-width:calc(100vw - 2rem)"></div>

  <!-- == Material ripple == -->
  <script>
    (function () {
      function ripple(e) {
        var t = e.currentTarget; if (!t) return;
        var rect = t.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height);
        var ink = document.createElement("span");
        ink.className = "md-ripple-ink";
        ink.style.width = ink.style.height = size + "px";
        ink.style.left = ((e.clientX || rect.left + rect.width / 2) - rect.left - size / 2) + "px";
        ink.style.top  = ((e.clientY || rect.top + rect.height / 2) - rect.top - size / 2) + "px";
        t.appendChild(ink);
        setTimeout(function () { if (ink.parentNode) ink.parentNode.removeChild(ink); }, 560);
      }
      function attach() {
        var els = document.querySelectorAll(".btn-primary,.btn-secondary,.secondary");
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          if (el.__md_rip) continue; el.__md_rip = 1;
          if (getComputedStyle(el).position === "static") el.style.position = "relative";
          el.style.overflow = "hidden";
          el.addEventListener("click", ripple);
        }
      }
      var scheduled = false;
      function schedule() { if (scheduled) return; scheduled = true; requestAnimationFrame(function () { scheduled = false; attach(); }); }
      if (document.readyState !== "loading") attach();
      document.addEventListener("DOMContentLoaded", attach);
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    })();
  </script>

  <script>
    let dashboardData = null;
    let inadimplentesView = [];
    let filtroCategoria = null;
    let finalizadosView = [];
    let desconsideradosView = [];
    let sortState = { key: "valor_total", dir: "desc" };

    const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

    function showToast(texto, classe) {
      const area = document.getElementById("toast-area");
      const toast = document.createElement("div");
      toast.className = "toast " + (classe || "");
      const icon = classe === "err" ? "error" : (classe === "warn" ? "warning" : "check_circle");
      const titulo = classe === "err" ? "Não foi possível concluir" : (classe === "warn" ? "Atenção" : "Concluído");
      toast.innerHTML =
        "<span class='toast-icon'><span class='md-icon' style='font-size:20px'>" + icon + "</span></span>" +
        "<span><strong class='toast-title'>" + titulo + "</strong><span class='toast-message'></span></span>" +
        "<button type='button' class='toast-close' aria-label='Fechar'><span class='md-icon' style='font-size:18px'>close</span></button>";
      toast.querySelector(".toast-message").textContent = texto;
      toast.querySelector(".toast-close").addEventListener("click", function () {
        removerToast_(toast);
      });
      area.appendChild(toast);
      while (area.children.length > 3) area.removeChild(area.firstChild);
      setTimeout(function () {
        removerToast_(toast);
      }, classe === "err" ? 9000 : 7000);
    }

    function removerToast_(toast) {
      if (!toast || !toast.parentNode) return;
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      toast.style.transition = "opacity .18s, transform .18s";
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 190);
    }

    function setImportStatus(texto, classe) {
      const el = document.getElementById("import-status");
      el.className = "status-line " + (classe || "");
      el.textContent = texto || "";
    }

    function setImportProgress(percent, texto, indeterminate) {
      const wrap = document.getElementById("import-progress");
      const bar = document.getElementById("import-progress-bar");
      if (!wrap || !bar) return;
      wrap.classList.add("visible");
      bar.classList.toggle("indeterminate", Boolean(indeterminate));
      if (!indeterminate) bar.style.width = Math.max(0, Math.min(100, percent || 0)) + "%";
      setImportStatus(texto || "");
    }

    function setImportBusy(busy) {
      const btn = document.getElementById("btn-importar-excel");
      const texto = document.getElementById("btn-importar-texto");
      if (!btn || !texto) return;
      btn.disabled = Boolean(busy);
      btn.style.opacity = busy ? ".72" : "1";
      btn.style.cursor = busy ? "wait" : "pointer";
      texto.textContent = busy ? "Importando..." : "Importar Excel";
    }

    function limparImportacaoDepois_(mensagem) {
      const input = document.getElementById("arquivo-excel");
      const nome = document.getElementById("arquivo-nome");
      const wrap = document.getElementById("import-progress");
      const bar = document.getElementById("import-progress-bar");
      if (input) input.value = "";
      if (nome) nome.textContent = "Nenhum arquivo escolhido";
      if (bar) {
        bar.classList.remove("indeterminate");
        bar.style.width = "100%";
      }
      if (wrap) wrap.classList.add("visible");
      setImportStatus(mensagem, "ok");
      setImportBusy(false);

      setTimeout(function () {
        if (wrap) wrap.classList.remove("visible");
        if (bar) bar.style.width = "0";
        setImportStatus("");
        fecharMenu_("import-menu", "_closeImportOnOutside");
      }, 3800);
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

    function mostrarNomeArquivo() {
      var inp = document.getElementById("arquivo-excel");
      var el = document.getElementById("arquivo-nome");
      if (!inp || !el) return;
      el.textContent = (inp.files && inp.files[0]) ? inp.files[0].name : "Nenhum arquivo escolhido";
      var wrap = document.getElementById("import-progress");
      if (wrap) wrap.classList.remove("visible");
      setImportStatus("");
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

      setImportBusy(true);
      setImportProgress(4, "Preparando " + arquivo.name + "...", false);

      const reader = new FileReader();

      reader.onprogress = function (event) {
        if (!event.lengthComputable) {
          setImportProgress(0, "Lendo arquivo...", true);
          return;
        }
        const leitura = Math.round((event.loaded / event.total) * 55);
        setImportProgress(leitura, "Lendo arquivo... " + Math.round((event.loaded / event.total) * 100) + "%", false);
      };

      reader.onload = function () {
        const dataUrl = String(reader.result || "");
        const base64 = dataUrl.indexOf(",") >= 0 ? dataUrl.split(",")[1] : dataUrl;

        setImportProgress(60, "Enviando arquivo...", false);
        setTimeout(function () {
          setImportProgress(0, "Processando cobranças e atualizando a base...", true);
        }, 250);

        google.script.run
          .withSuccessHandler(function (resumo) {
            limparImportacaoDepois_("Arquivo importado com sucesso.");
            showToast(resumoImportacaoTexto(resumo), "ok");
            carregarDashboard();
          })
          .withFailureHandler(function (erro) {
            setImportBusy(false);
            setImportProgress(0, "Falha na importação.", false);
            showToast(erro && erro.message ? erro.message : String(erro), "err");
          })
          .importarArquivoExcelUpload({
            filename: arquivo.name,
            mimeType: arquivo.type,
            base64: base64
          });
      };

      reader.onerror = function () {
        setImportBusy(false);
        setImportProgress(0, "Não foi possível ler o arquivo.", false);
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

    function gerarRelatorio(tipo) {
      fecharMenu_("report-menu", "_closeReportOnOutside");
      const nomeTipo = tipo === "detalhado" ? "detalhado" : "resumido";
      showToast("Gerando relatório " + nomeTipo + "...", "ok");
      google.script.run
        .withSuccessHandler(function (res) {
          if (!res || !res.base64) { showToast("Falha ao gerar relatório.", "err"); return; }
          baixarBase64_(res.base64, res.filename || "relatorio.pdf", "application/pdf");
          showToast("Relatório " + nomeTipo + " gerado.", "ok");
        })
        .withFailureHandler(function (erro) { showToast(erro && erro.message ? erro.message : String(erro), "err"); })
        .gerarRelatorioPdf(nomeTipo);
    }

    function baixarBase64_(base64, filename, mime) {
      var bin = atob(base64);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      var blob = new Blob([arr], { type: mime });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 1500);
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
      var _atualEm = data.atualizado_em ? "Atualizado em " + formatarDataBR(data.atualizado_em) : "Carregando...";
      var _totClientes = (data.inadimplentes || []).length;
      var _totDups     = kpis.duplicatas_vencidas || 0;
      var _atrasoMax   = kpis.maior_atraso || 0;
      document.getElementById("subtitulo").textContent = _atualEm + "  ·  " + _totClientes + " inadimplentes  ·  " + _totDups + " duplicatas  ·  " + _atrasoMax + " dias de atraso máx.";
      var _vencOrig = kpis.total_vencido || 0;
      var _vencAdj  = (kpis.total_vencido_ajustado !== undefined) ? kpis.total_vencido_ajustado : _vencOrig;
      var _origEl   = document.getElementById("kpi-vencido-original");
      var _kpiEl    = document.getElementById("kpi-vencido");
      _kpiEl.textContent = moeda.format(_vencAdj);
      if (_origEl) {
        if (Math.round(_vencAdj * 100) !== Math.round(_vencOrig * 100)) {
          _origEl.textContent = moeda.format(_vencOrig);
          _origEl.style.display = "block";
        } else {
          _origEl.style.display = "none";
        }
      }
      const _todos = data.inadimplentes || [];
      finalizadosView = _todos.filter(function(i) { return i.status_contato === "FINALIZADO"; });
      desconsideradosView = _todos.filter(function(i) { return i.status_cadastro === "DESCONSIDERADO" && i.status_contato !== "FINALIZADO" && (i.duplicatas_vencidas || 0) > 1; });
      inadimplentesView = _todos.filter(function(i) { return (i.duplicatas_vencidas || 0) > 1 && i.status_contato !== "FINALIZADO" && i.status_cadastro !== "DESCONSIDERADO"; }).slice();
      const _kpiProt = document.getElementById("kpi-protestado");
      if (_kpiProt) _kpiProt.textContent = moeda.format(kpis.total_protestado || 0);
      aplicarOrdenacaoInadimplentes();
      const _filtroEl = document.getElementById("filtro-cliente");
      filtrarInadimplentes(_filtroEl ? _filtroEl.value : "");
      renderFinalizados(finalizadosView);
      renderDesconsiderados(desconsideradosView);
      renderGraficos(_todos);
    }

    function formatarDataBR(str) {
      if (!str) return "";
      var m = str.match(/^(\d{4})-(\d{2})-(\d{2})([ T].+)?$/);
      return m ? m[3] + "/" + m[2] + "/" + m[1] + (m[4] || "") : str;
    }

    function toggleImportMenu() {
      toggleMenu_("import-menu", "report-menu", _closeImportOnOutside);
    }

    function _closeImportOnOutside(e) {
      var menu = document.getElementById("import-menu");
      var trigger = document.getElementById("btn-import-trigger");
      if (menu && !menu.contains(e.target) && trigger && !trigger.contains(e.target)) {
        fecharMenu_("import-menu", "_closeImportOnOutside");
      }
    }

    function toggleReportMenu() {
      toggleMenu_("report-menu", "import-menu", _closeReportOnOutside);
    }

    function _closeReportOnOutside(e) {
      var menu = document.getElementById("report-menu");
      var trigger = document.getElementById("btn-report-trigger");
      if (menu && !menu.contains(e.target) && trigger && !trigger.contains(e.target)) {
        fecharMenu_("report-menu", "_closeReportOnOutside");
      }
    }

    function toggleMenu_(menuId, outroMenuId, outsideHandler) {
      var menu = document.getElementById(menuId);
      if (!menu) return;
      var aberto = window.getComputedStyle(menu).display !== "none";
      var outro = document.getElementById(outroMenuId);
      if (outro) outro.style.display = "none";
      menu.style.display = aberto ? "none" : "block";
      document.removeEventListener("click", outsideHandler, true);
      if (!aberto) {
        setTimeout(function () {
          document.addEventListener("click", outsideHandler, true);
        }, 0);
      }
    }

    function fecharMenu_(menuId, handlerName) {
      var menu = document.getElementById(menuId);
      if (menu) menu.style.display = "none";
      var handler = window[handlerName];
      if (handler) document.removeEventListener("click", handler, true);
    }

    function renderGraficos(inadimplentes) {
      var filtrado = (inadimplentes || []).filter(function(i) { return (i.duplicatas_vencidas || 0) > 1 && i.status_contato !== "FINALIZADO" && i.status_cadastro !== "DESCONSIDERADO"; });
      var total = filtrado.length;

      var CONTATO_DEFS = [
        { key: "EM ABERTO",  cor: "#d1d5db", textCor: "#6b7280" },
        { key: "EM CONTATO", cor: "#93c5fd", textCor: "#1d4ed8" },
        { key: "AGENDADO",   cor: "#c4b5fd", textCor: "#6d28d9" },
      ];
      var contatoCounts = {};
      var contatoTotals = {};
      CONTATO_DEFS.forEach(function(d) { contatoCounts[d.key] = 0; contatoTotals[d.key] = 0; });
      filtrado.forEach(function(i) {
        var k = i.status_contato || "EM ABERTO";
        contatoCounts[k] = (contatoCounts[k] || 0) + 1;
        contatoTotals[k] = (contatoTotals[k] || 0) + (i.valor_total || 0);
      });

      var CADASTRO_DEFS = [
        { key: "SUSPENSO",       cor: "#fcd34d", textCor: "#b45309" },
        { key: "CANCELADO",      cor: "#f87171", textCor: "#991b1b" },
        { key: "PROTESTADO",     cor: "#fb7185", textCor: "#9f1239" },
        { key: "PERMUTA",        cor: "#5eead4", textCor: "#0f766e" },
        { key: "DESCONSIDERADO", cor: "#d1d5db", textCor: "#6b7280" },
      ];
      var cadastroCounts = {};
      var cadastroTotals = {};
      CADASTRO_DEFS.forEach(function(d) { cadastroCounts[d.key] = 0; cadastroTotals[d.key] = 0; });
      var filtradoCadastro = (inadimplentes || []).filter(function(i) { return (i.duplicatas_vencidas || 0) > 1 && i.status_contato !== "FINALIZADO"; });
      filtradoCadastro.forEach(function(i) {
        if (i.status_cadastro && cadastroCounts.hasOwnProperty(i.status_cadastro)) {
          cadastroCounts[i.status_cadastro]++;
          cadastroTotals[i.status_cadastro] = (cadastroTotals[i.status_cadastro] || 0) + (i.valor_total || 0);
        }
      });
      var totalCadastro = CADASTRO_DEFS.reduce(function(a, d) { return a + (cadastroCounts[d.key] || 0); }, 0);

      var el1 = document.getElementById("grafico-contato");
      var el2 = document.getElementById("grafico-cadastro");
      if (el1) el1.innerHTML = buildGrafico_("status_contato", "STATUS DE CONTATO", total + " cliente(s) c/ 2+ duplicatas", CONTATO_DEFS, contatoCounts, contatoTotals);
      if (el2) el2.innerHTML = buildGrafico_("status_cadastro", "STATUS DE CADASTRO", totalCadastro + " com status especial", CADASTRO_DEFS, cadastroCounts, cadastroTotals);
    }

    function buildGrafico_(campo, titulo, subtitulo, defs, counts, totals) {
      var totalVis = defs.reduce(function(a, d) { return a + (counts[d.key] || 0); }, 0);
      var barHtml = totalVis
        ? defs.map(function(d) {
            var n = counts[d.key] || 0;
            if (!n) return "";
            var pct = (n / totalVis * 100).toFixed(2);
            var ativo = filtroCategoria && filtroCategoria.campo === campo && filtroCategoria.valor === d.key;
            var opac = (filtroCategoria && !ativo) ? ";opacity:.3" : "";
            return "<div title='" + escapeHtml(d.key) + ": " + n + "' style='flex:" + pct + ";background:" + d.cor + ";min-width:2px" + opac + "'></div>";
          }).join("")
        : "<div style='flex:1;background:var(--md-surface-container-high)'></div>";

      var legendHtml = defs.map(function(d) {
        var n = counts[d.key] || 0;
        if (!n) return "";
        var valorStr = (totals && totals[d.key]) ? moeda.format(totals[d.key]) : "";
        var ativo = filtroCategoria && filtroCategoria.campo === campo && filtroCategoria.valor === d.key;
        var dim = filtroCategoria && !ativo;
        var wrapStyle = "display:flex;align-items:flex-start;gap:5px;cursor:pointer;padding:3px 7px;border-radius:8px;transition:background .15s,opacity .15s,box-shadow .15s"
          + (ativo ? ";background:var(--md-primary-container);box-shadow:inset 0 0 0 1px var(--md-primary)" : "")
          + (dim ? ";opacity:.4" : "");
        return "<div class='legend-chip" + (ativo ? " is-active" : "") + "' role='button' tabindex='0' onclick='toggleFiltroCategoria(&quot;" + campo + "&quot;,&quot;" + escapeAttr(d.key) + "&quot;)' title='Filtrar lista por " + escapeHtml(d.key) + "' style='" + wrapStyle + "'>" +
          "<span style='width:8px;height:8px;border-radius:50%;background:" + d.cor + ";flex-shrink:0;display:inline-block;margin-top:3px'></span>" +
          "<div style='display:flex;flex-direction:column;gap:1px'>" +
            "<span style='font-size:.7rem;color:" + d.textCor + ";white-space:nowrap'>" + escapeHtml(d.key) + " <strong style='color:var(--md-on-surface)'>" + n + "</strong></span>" +
            (valorStr ? "<span style='font-size:.6875rem;font-weight:600;color:" + d.textCor + ";white-space:nowrap'>" + valorStr + "</span>" : "") +
          "</div>" +
        "</div>";
      }).join("");
      if (!legendHtml) legendHtml = "<span style='font-size:.7rem;color:var(--md-on-surface-variant)'>Nenhum</span>";

      return "<span style='display:block;font-size:.7rem;font-weight:600;color:var(--md-on-surface-variant);text-transform:uppercase;letter-spacing:.08em'>" + titulo + "</span>" +
        "<span style='display:block;font-size:.75rem;color:var(--md-on-surface-variant);margin:.2rem 0 0'>" + subtitulo + "</span>" +
        "<div style='display:flex;height:8px;border-radius:4px;overflow:hidden;margin:.875rem 0 .75rem;background:var(--md-surface-container-high)'>" + barHtml + "</div>" +
        "<div style='display:flex;flex-wrap:wrap;gap:4px 6px;margin:0 -7px'>" + legendHtml + "</div>";
    }

    function toggleFiltroCategoria(campo, valor) {
      if (campo === "status_cadastro" && valor === "DESCONSIDERADO") {
        var _sec = document.getElementById("desconsiderados-section");
        if (_sec && _sec.style.display !== "none") _sec.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (filtroCategoria && filtroCategoria.campo === campo && filtroCategoria.valor === valor) {
        filtroCategoria = null;
      } else {
        filtroCategoria = { campo: campo, valor: valor };
      }
      var _f = document.getElementById("filtro-cliente");
      filtrarInadimplentes(_f ? _f.value : "");
      renderGraficos(dashboardData ? (dashboardData.inadimplentes || []) : []);
    }

    function limparFiltro() {
      const el = document.getElementById("filtro-cliente");
      if (el) { el.value = ""; el.focus(); }
      const clr = document.getElementById("filtro-clear");
      if (clr) clr.style.display = "none";
      filtrarInadimplentes("");
    }

    function filtrarInadimplentes(termo) {
      if (!dashboardData) return;
      const q = (termo || "").trim().toLowerCase();
      var lista = (inadimplentesView || []);
      if (filtroCategoria) {
        lista = lista.filter(function (i) {
          if (filtroCategoria.campo === "status_contato") {
            return (i.status_contato || "EM ABERTO") === filtroCategoria.valor;
          }
          return (i.status_cadastro || "") === filtroCategoria.valor;
        });
      }
      if (q) {
        lista = lista.filter(function (i) {
          return (i.cliente || "").toLowerCase().indexOf(q) !== -1;
        });
      }
      renderInadimplentes(lista);
    }

    function renderInadimplentes(lista) {
      const body = document.getElementById("inadimplentes-body");
      body.innerHTML = "";
      var _info = lista.length + " cliente(s) com 2+ duplicatas vencidas.";
      if (filtroCategoria) _info += "  ·  filtro: " + filtroCategoria.valor + " (clique na categoria p/ limpar)";
      document.getElementById("lista-info").textContent = _info;
      atualizarMarcadoresOrdenacao();

      if (!lista.length) {
        body.innerHTML = '<tr><td colspan="6" class="px-5 py-10 text-center muted">Nenhum inadimplente encontrado.</td></tr>';
        return;
      }

      const _hoje = new Date().toISOString().substring(0, 10);
      lista.forEach(function (item) {
        const tr = document.createElement("tr");
        const _agVencido = item.status_contato === "AGENDADO" &&
          item.data_agendamento_cliente && item.data_agendamento_cliente < _hoje;
        tr.className = "cliente-row" + (_agVencido ? " row-ag-vencido" : "");
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

    function renderFinalizados(lista) {
      const section = document.getElementById("finalizados-section");
      const body = document.getElementById("finalizados-body");
      const info = document.getElementById("finalizados-info");
      if (!section || !body) return;
      if (!lista || !lista.length) {
        section.style.display = "none";
        return;
      }
      section.style.display = "";
      var _tot = lista.reduce(function(s, i) { return s + (i.valor_total || 0); }, 0);
      if (info) info.textContent = lista.length + " cliente(s)  \u00b7  " + moeda.format(_tot);
      body.innerHTML = "";
      lista.forEach(function(item) {
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
        tr.addEventListener("click", function() { toggleDetalheCliente(item); });
        body.appendChild(tr);
        const detailTr = document.createElement("tr");
        detailTr.className = "expanded-row";
        detailTr.dataset.detailFor = item.id;
        detailTr.hidden = true;
        detailTr.innerHTML = "<td colspan='6' class='detail-cell'>" + detalheClienteHtml(item) + "</td>";
        body.appendChild(detailTr);
      });
    }

    function renderDesconsiderados(lista) {
      const section = document.getElementById("desconsiderados-section");
      const body = document.getElementById("desconsiderados-body");
      const info = document.getElementById("desconsiderados-info");
      if (!section || !body) return;
      if (!lista || !lista.length) { section.style.display = "none"; return; }
      section.style.display = "";
      var _tot = lista.reduce(function(s, i) { return s + (i.valor_total || 0); }, 0);
      if (info) info.textContent = lista.length + " cliente(s) desconsiderado(s)  \u00b7  " + moeda.format(_tot);
      body.innerHTML = "";
      lista.forEach(function(item) {
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
        tr.addEventListener("click", function() { toggleDetalheCliente(item); });
        body.appendChild(tr);
        const detailTr = document.createElement("tr");
        detailTr.className = "expanded-row";
        detailTr.dataset.detailFor = item.id;
        detailTr.hidden = true;
        detailTr.innerHTML = "<td colspan='6' class='detail-cell'>" + detalheClienteHtml(item) + "</td>";
        body.appendChild(detailTr);
      });
    }

    function statusFinalizadoHtml(item) {
      const status = item.status_contato || "";
      const badgeClass = statusContatoClass_(status);
      return status ? "<span class='" + badgeClass + "'>" + escapeHtml(status) + "</span>" : "<span class='muted'>—</span>";
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
      const cadastro = item.status_cadastro || "";
      const dataCadastro = item.data_status_cadastro_cliente || "";
      const cadDateHtml = ((cadastro === "PROTESTADO" || cadastro === "DESCONSIDERADO") && dataCadastro)
        ? "<span class='status-note'>" + escapeHtml(cadastro === "PROTESTADO" ? "Protesto" : "Desconsid.") + ": " + formatDateBR(dataCadastro) + "</span>"
        : "";
      const obsHtml = observacao ? "<span class='status-note' title='" + escapeHtml(observacao) + "'>" + escapeHtml(observacao) + "</span>" : "";
      return statusHtml + dateHtml + cadDateHtml + obsHtml;
    }

    function statusContatoClass_(status) {
      if (status === "EM CONTATO") return "status-badge status-contact";
      if (status === "AGENDADO")   return "status-badge status-scheduled";
      if (status === "FINALIZADO") return "status-badge status-finalizado";
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

      // Ordenacao inteligente padrao: AGENDADO primeiro (data asc), depois por valor_total desc
      if (sortState.key === "valor_total" && sortState.dir === "desc") {
        inadimplentesView.sort(function(a, b) {
          const aAg = a.status_contato === "AGENDADO";
          const bAg = b.status_contato === "AGENDADO";
          if (aAg !== bAg) return aAg ? -1 : 1;
          if (aAg && bAg) {
            const da = a.data_agendamento_cliente || "9999";
            const db = b.data_agendamento_cliente || "9999";
            return da < db ? -1 : da > db ? 1 : 0;
          }
          const diff = (b.valor_total || 0) - (a.valor_total || 0);
          if (diff !== 0) return diff;
          return String(a.cliente || "").localeCompare(String(b.cliente || ""), "pt-BR");
        });
        return;
      }

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
      const target = document.querySelector('tr.expanded-row[data-detail-for="' + cssEscape(item.id) + '"]');
      if (!target) return;
      const tb = target.parentNode;
      const willOpen = target.hidden;
      Array.prototype.forEach.call(tb.querySelectorAll("tr.expanded-row"), function (row) {
        row.hidden = true;
      });
      target.hidden = !willOpen;
    }

    function detalheClienteHtml(item) {
      const dups = item.duplicatas || [];
      const totalAReceber = dups.reduce(function(s, d) { return s + (d.valor_a_receber || 0); }, 0);

      const linhas = dups.map(function(dup) {
        const agrupado = (dup.itens_agrupados || 0) > 1
          ? " <span style='font-size:.65rem;color:#a5b4fc;font-weight:500'>(" + dup.itens_agrupados + "×)</span>" : "";
        const diasCor = (dup.dias_atraso || 0) > 90 ? "#ef4444" : (dup.dias_atraso || 0) > 30 ? "#f59e0b" : "#6b7280";
        return "<tr>" +
          "<td style='font-weight:600;color:#1e1b4b;white-space:nowrap'>" + escapeHtml(dup.numero || "—") + agrupado + "</td>" +
          "<td><span class='" + pillClass_(dup.status_cobranca) + "'>" + escapeHtml(dup.status_cobranca || "VENCIDO") + "</span></td>" +
          "<td style='white-space:nowrap;color:#374151'>" + escapeHtml(formatDateBR(dup.vencimento)) + "</td>" +
          "<td style='text-align:right;white-space:nowrap;color:" + diasCor + ";font-weight:500'>" + (dup.dias_atraso || 0) + "d</td>" +
          "<td style='overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6b7280' title='" + escapeHtml(dup.categoria) + "'>" + escapeHtml(dup.categoria) + "</td>" +
          "<td style='text-align:right;white-space:nowrap;font-weight:700;color:#111827;letter-spacing:-.01em'>" + moeda.format(dup.valor_a_receber || 0) + "</td>" +
        "</tr>";
      }).join("");

      const footer =
        "<tr>" +
          "<td colspan='5' style='color:#6b7280;font-weight:500'>" + dups.length + " duplicata" + (dups.length !== 1 ? "s" : "") + "</td>" +
          "<td style='text-align:right;font-weight:700;color:#1e1b4b;font-size:.875rem'>" + moeda.format(totalAReceber) + "</td>" +
        "</tr>";

      return "<div class='inline-detail'>" +
        "<table class='detail-tbl'>" +
          "<colgroup>" +
            "<col style='width:12%'><col style='width:10%'><col style='width:11%'><col style='width:8%'><col><col style='width:14%'>" +
          "</colgroup>" +
          "<thead><tr>" +
            "<th>Número</th>" +
            "<th>Status</th>" +
            "<th>Vencimento</th>" +
            "<th style='text-align:right'>Atraso</th>" +
            "<th>Categoria</th>" +
            "<th style='text-align:right'>A receber</th>" +
          "</tr></thead>" +
          "<tbody>" + linhas + "</tbody>" +
          "<tfoot>" + footer + "</tfoot>" +
        "</table>" +
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
      document.getElementById("status-data-cadastro").value = item.data_status_cadastro_cliente || "";
      document.getElementById("cadastro-data-row").style.display = (item.status_cadastro === "PROTESTADO" || item.status_cadastro === "DESCONSIDERADO") ? "" : "none";
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
        data_status_cadastro: document.getElementById("status-data-cadastro").value,
        observacao: document.getElementById("status-observacao").value
      };

      item.status_contato = payload.status_cobranca;
      item.status_cliente  = payload.status_cobranca;
      item.status_cadastro = payload.status_cadastro;
      item.data_agendamento_cliente = (payload.status_cobranca === "AGENDADO") ? payload.data_agendamento : "";
      item.data_status_cadastro_cliente = (payload.status_cadastro === "PROTESTADO" || payload.status_cadastro === "DESCONSIDERADO") ? payload.data_status_cadastro : "";
      item.observacao_cliente = payload.observacao;
      atualizarLinhaClienteOtimista(item);

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

    function atualizarLinhaClienteOtimista(item) {
      const tr = document.querySelector('tr.cliente-row[data-id="' + escapeAttr(item.id) + '"]');
      if (!tr) return;
      const tds = tr.querySelectorAll('td');
      if (tds[0]) tds[0].innerHTML = "<div class='cell-nome'>" + clienteNomeHtml(item) + "<span class='cnpj-line'>" + escapeHtml(item.cnpj_cpf) + "</span></div>";
      if (tds[1]) tds[1].innerHTML = statusClienteHtml(item);
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
    const dataStatusCadastro = (statusCadastro === "PROTESTADO" || statusCadastro === "DESCONSIDERADO") ? (payload && payload.data_status_cadastro || "") : "";
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
        data_status_cadastro: dataStatusCadastro,
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
      data_status_cadastro: dataStatusCadastro,
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

function gerarRelatorioPdf(tipo) {
  tipo = tipo === "detalhado" ? "detalhado" : "resumido";

  var data = getDashboardCobrancas();
  var kpis = data.kpis || {};
  var todos = data.inadimplentes || [];
  var porValor = function(a, b) { return (b.valor_total || 0) - (a.valor_total || 0); };
  var inad = todos.filter(function(i) { return (i.duplicatas_vencidas || 0) > 1 && i.status_contato !== "FINALIZADO" && i.status_cadastro !== "DESCONSIDERADO"; }).sort(porValor);
  var desc = todos.filter(function(i) { return i.status_cadastro === "DESCONSIDERADO" && i.status_contato !== "FINALIZADO" && (i.duplicatas_vencidas || 0) > 1; }).sort(porValor);
  var fin = todos.filter(function(i) { return i.status_contato === "FINALIZADO"; }).sort(porValor);

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function moeda(n) {
    n = Math.round(Number(n || 0) * 100) / 100;
    var neg = n < 0;
    n = Math.abs(n);
    var s = n.toFixed(2).split(".");
    var x = "";
    for (var i = 0; i < s[0].length; i++) {
      if (i > 0 && (s[0].length - i) % 3 === 0) x += ".";
      x += s[0].charAt(i);
    }
    return (neg ? "-" : "") + "R$ " + x + "," + s[1];
  }

  function dbr(iso) {
    if (!iso) return "";
    var p = String(iso).substring(0, 10).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : String(iso);
  }

  function documentoFormatado(value) {
    var d = String(value || "").replace(/\D/g, "");
    if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    return d;
  }

  function contatoTxt(item) {
    var s = item.status_contato || "EM ABERTO";
    if (s === "AGENDADO" && item.data_agendamento_cliente) s += " (" + dbr(item.data_agendamento_cliente) + ")";
    return s;
  }

  function cadastroTxt(item) {
    var s = item.status_cadastro || "";
    if ((s === "PROTESTADO" || s === "DESCONSIDERADO") && item.data_status_cadastro_cliente) {
      s += " (" + dbr(item.data_status_cadastro_cliente) + ")";
    }
    return s || "-";
  }

  function soma(lista) {
    return lista.reduce(function(total, item) { return total + Number(item.valor_total || 0); }, 0);
  }

  function agregaStatus(lista, campo, chave) {
    var resultado = { n: 0, v: 0 };
    lista.forEach(function(item) {
      var valor = campo === "status_contato" ? (item[campo] || "EM ABERTO") : (item[campo] || "");
      if (valor === chave) {
        resultado.n += 1;
        resultado.v += Number(item.valor_total || 0);
      }
    });
    return resultado;
  }

  function card(label, valor, detalhe, classe) {
    return "<div class='kpi " + (classe || "") + "'>" +
      "<div class='kpi-label'>" + esc(label) + "</div>" +
      "<div class='kpi-value'>" + moeda(valor) + "</div>" +
      (detalhe ? "<div class='kpi-detail'>" + esc(detalhe) + "</div>" : "") +
    "</div>";
  }

  function cardsResumo() {
    var totalAjustado = kpis.total_vencido_ajustado !== undefined ? kpis.total_vencido_ajustado : (kpis.total_vencido || 0);
    var html = "<div class='kpi-title'>Financeiro</div><div class='kpis'>";
    html += card("Total vencido ajustado", totalAjustado, "", "danger");
    html += card("Carteira em cobrança", soma(inad), inad.length + " clientes", "");
    html += card("Desconsiderado", soma(desc), desc.length + " clientes", "muted-card");
    html += card("Protestado", soma(fin), fin.length + " clientes", "success-card");
    html += "</div><div class='kpi-title'>Status de contato</div><div class='kpis'>";
    ["EM ABERTO", "EM CONTATO", "AGENDADO"].forEach(function(status) {
      var a = agregaStatus(inad, "status_contato", status);
      html += card(status, a.v, a.n + " clientes", "");
    });
    html += "</div><div class='kpi-title'>Status de cadastro</div><div class='kpis'>";
    ["SUSPENSO", "CANCELADO", "PROTESTADO", "PERMUTA", "DESCONSIDERADO"].forEach(function(status) {
      var a = agregaStatus(todos, "status_cadastro", status);
      if (a.n) html += card(status, a.v, a.n + " clientes", "muted-card");
    });
    return html + "</div>";
  }

  function linhaResumo(item, idx) {
    return "<tr>" +
      "<td class='center index-col'>" + idx + "</td>" +
      "<td><strong>" + esc(item.cliente) + "</strong><br><span class='doc'>" + esc(documentoFormatado(item.cnpj_cpf)) + "</span></td>" +
      "<td>" + esc(contatoTxt(item)) + "</td>" +
      "<td>" + esc(cadastroTxt(item)) + "</td>" +
      "<td class='center dup-col'>" + (item.duplicatas_vencidas || 0) + "</td>" +
      "<td class='right money-col'>" + moeda(item.valor_total || 0) + "</td>" +
      "<td class='observation'>" + esc(item.observacao_cliente || "") + "</td>" +
    "</tr>";
  }

  function tabelaResumo(titulo, lista, cor) {
    if (!lista.length) return "";
    var rows = lista.map(function(item, idx) { return linhaResumo(item, idx + 1); }).join("");
    return "<section class='report-section'>" +
      "<h2 style='border-left-color:" + cor + "'>" + esc(titulo) + "<span>" + lista.length + " clientes &middot; " + moeda(soma(lista)) + "</span></h2>" +
      "<table class='summary-table'>" +
        "<colgroup><col class='col-index'><col class='col-client'><col class='col-contact'><col class='col-register'><col class='col-dup'><col class='col-money'><col class='col-observation'></colgroup>" +
        "<thead><tr><th class='center'>#</th><th>Cliente</th><th>Contato</th><th>Cadastro</th><th class='center'>Dup.</th><th class='right'>Valor</th><th>Observação</th></tr></thead>" +
        "<tbody>" + rows + "</tbody>" +
      "</table>" +
    "</section>";
  }

  function linhaDuplicata(dup) {
    return "<tr>" +
      "<td><strong>" + esc(dup.numero || "Sem número") + "</strong>" +
        (dup.parcela ? "<span class='inline-detail-text'> &middot; " + esc(dup.parcela) + "</span>" : "") +
        ((dup.itens_agrupados || 0) > 1 ? "<span class='inline-detail-text'> &middot; " + dup.itens_agrupados + " itens</span>" : "") +
      "</td>" +
      "<td>" + esc(dbr(dup.vencimento)) + "<span class='inline-detail-text'> &middot; " + Number(dup.dias_atraso || 0) + "d</span></td>" +
      "<td>" + esc(dup.categoria || "-") + "</td>" +
      "<td class='right money-col'><strong>" + moeda(dup.valor_a_receber || 0) + "</strong></td>" +
      "<td>" + esc(dup.status_cobranca || "VENCIDO") + "</td>" +
    "</tr>";
  }

  function clienteDetalhado(item, idx, cor) {
    var duplicatas = item.duplicatas || [];
    var rows = duplicatas.map(linhaDuplicata).join("");
    return "<div class='compact-client' style='--section-color:" + cor + "'>" +
      "<div class='compact-client-head'>" +
        "<span class='client-index'>" + idx + "</span>" +
        "<span class='compact-client-name'><strong>" + esc(item.cliente) + "</strong><small>" + esc(documentoFormatado(item.cnpj_cpf)) + "</small></span>" +
        "<span class='client-meta'>" + esc(contatoTxt(item)) + " &middot; " + esc(cadastroTxt(item)) + " &middot; " + duplicatas.length + " dup. &middot; <strong>" + moeda(item.valor_total || 0) + "</strong></span>" +
      "</div>" +
      (item.observacao_cliente ? "<div class='compact-note'><strong>Obs.:</strong> " + esc(item.observacao_cliente) + "</div>" : "") +
      "<table class='compact-detail-table'>" +
        "<colgroup><col style='width:19%'><col style='width:15%'><col style='width:42%'><col style='width:14%'><col style='width:10%'></colgroup>" +
        "<thead><tr><th>Número / parcela</th><th>Vencimento</th><th>Categoria</th><th class='right'>A receber</th><th>Status</th></tr></thead>" +
        "<tbody>" + rows + "</tbody>" +
      "</table>" +
    "</div>";
  }

  function secaoDetalhada(titulo, lista, cor) {
    if (!lista.length) return "";
    var conteudo = lista.map(function(item, idx) { return clienteDetalhado(item, idx + 1, cor); }).join("");
    return "<section class='detail-section'><h2 style='border-left-color:" + cor + "'>" + esc(titulo) + "<span>" + lista.length + " clientes &middot; " + moeda(soma(lista)) + "</span></h2>" + conteudo + "</section>";
  }

  function estimarLinhasTexto(texto, caracteresPorLinha) {
    var tamanho = String(texto || "").length;
    return tamanho ? Math.max(1, Math.ceil(tamanho / caracteresPorLinha)) : 0;
  }

  function estimarAlturaRelatorioMm() {
    var listas = inad.concat(desc).concat(fin);
    var altura = tipo === "detalhado" ? 105 : 115;

    listas.forEach(function(item) {
      altura += tipo === "detalhado" ? 9 : 7;
      altura += estimarLinhasTexto(item.observacao_cliente, tipo === "detalhado" ? 150 : 52) * (tipo === "detalhado" ? 3.4 : 4.2);
      if (tipo === "detalhado") {
        (item.duplicatas || []).forEach(function(dup) {
          altura += 4.6 + estimarLinhasTexto(dup.categoria, 55) * 2.2;
        });
      } else {
        altura += estimarLinhasTexto(item.cliente, 30) * 3.2;
      }
    });

    altura += 30;
    return Math.min(5000, Math.max(tipo === "detalhado" ? 500 : 420, Math.ceil(altura)));
  }

  var agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  var tituloTipo = tipo === "detalhado" ? "Relatório Detalhado de Cobranças" : "Relatório Resumido de Cobranças";
  var larguraMm = tipo === "detalhado" ? 297 : 210;
  var alturaMm = estimarAlturaRelatorioMm();

  var css = "@page{size:" + larguraMm + "mm " + alturaMm + "mm;margin:10mm}" +
    "*{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#202124;margin:0;font-size:" + (tipo === "detalhado" ? "8.5px" : "9.5px") + ";line-height:1.32}" +
    "header{margin-bottom:10px} h1{font-size:20px;margin:0 0 2px;color:#202124} .meta{color:#5f6368;margin:0;font-size:9px}" +
    ".kpi-title{font-size:7.5px;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;color:#5f6368;margin:8px 0 3px}" +
    ".kpis{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:4px}.kpi{min-width:118px;border:1px solid #dadce0;border-radius:8px;padding:6px 8px;background:#fff;break-inside:avoid}" +
    ".kpi.danger{border-color:#f2b8b5;background:#fff8f7}.kpi.success-card{background:#f3fbf5}.kpi.muted-card{background:#f8f9fa}" +
    ".kpi-label{font-size:7px;color:#5f6368;text-transform:uppercase;letter-spacing:.04em}.kpi-value{font-size:13px;font-weight:bold;margin-top:1px}.kpi-detail{font-size:7.5px;color:#5f6368;margin-top:1px}" +
    ".report-section,.detail-section{margin-top:12px}.report-section h2,.detail-section h2{font-size:11px;margin:0 0 4px;padding:4px 7px;border-left:4px solid #0b57d0;background:#f8f9fa;break-after:avoid}" +
    "h2 span{float:right;font-size:8.5px;font-weight:normal;color:#5f6368}" +
    "table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tfoot{display:table-row-group}" +
    "th{background:#eef1f6;color:#4b4f56;text-transform:uppercase;letter-spacing:.035em;font-size:7.2px;text-align:left;padding:5px 6px;border-bottom:1px solid #c8ccd2}" +
    "td{padding:5px 6px;border-bottom:1px solid #e5e7eb;vertical-align:top;overflow-wrap:anywhere}tbody tr{break-inside:avoid;page-break-inside:avoid}tbody tr:nth-child(even) td{background:#fbfcfe}" +
    ".center{text-align:center}.right{text-align:right}.doc{font-size:7.5px;color:#6b7280}.money-col{white-space:nowrap}.observation{white-space:normal}" +
    ".col-index{width:4%}.col-client{width:21%}.col-contact{width:15%}.col-register{width:14%}.col-dup{width:6%}.col-money{width:12%}.col-observation{width:28%}" +
    ".compact-client{margin:0 0 7px;border:1px solid #dfe3e8;border-left:3px solid var(--section-color);background:#fff}" +
    ".compact-client-head{display:flex;align-items:center;gap:7px;padding:4px 6px;background:#f4f7fc}.client-index{width:19px;height:19px;border-radius:50%;background:var(--section-color);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:7px}.compact-client-name strong{display:block;font-size:9px}.compact-client-name small{display:block;font-size:7px;color:#6b7280}.client-meta{margin-left:auto;font-size:7.5px;color:#4b5563;text-align:right}.compact-note{padding:3px 6px;background:#fffbe8;color:#5f4b00;font-size:7.5px}" +
    ".compact-detail-table th{padding:3px 5px;font-size:6.5px}.compact-detail-table td{padding:3px 5px;font-size:7.5px}.inline-detail-text{font-size:6.8px;color:#6b7280;font-weight:normal}";

  var conteudo = tipo === "detalhado"
    ? cardsResumo() + secaoDetalhada("INADIMPLENTES", inad, "#0b57d0") + secaoDetalhada("DESCONSIDERADOS", desc, "#80868b") + secaoDetalhada("PROTESTADOS", fin, "#146c43")
    : cardsResumo() + tabelaResumo("INADIMPLENTES", inad, "#0b57d0") + tabelaResumo("DESCONSIDERADOS", desc, "#80868b") + tabelaResumo("PROTESTADOS", fin, "#146c43");

  var html = "<!DOCTYPE html><html><head><meta charset='utf-8'><style>" + css + "</style></head><body>" +
    "<header><h1>" + tituloTipo + "</h1><p class='meta'>Gerado em " + agora + " &middot; versão " + APP_VERSION + "</p></header>" +
    conteudo +
    "</body></html>";

  var blob = Utilities.newBlob(html, "text/html", "relatorio.html").getAs("application/pdf");
  var dataArquivo = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var fname = "relatorio_cobrancas_" + tipo + "_" + dataArquivo + ".pdf";
  return { base64: Utilities.base64Encode(blob.getBytes()), filename: fname };
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
        data_status_cadastro: atual.data_status_cadastro || "",
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
        data_status_cadastro: "",
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
          data_status_cadastro: item.obj.data_status_cadastro || "",
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
  const dsc = normalized.data_status_cadastro;
  normalized.data_status_cadastro = (dsc instanceof Date)
    ? Utilities.formatDate(dsc, Session.getScriptTimeZone(), "yyyy-MM-dd")
    : (normalizeText_(dsc) || "");
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
    return excelSerialDateToIso_(value);
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

function excelSerialDateToIso_(value) {
  const serial = Number(value);
  if (!isFinite(serial)) return "";

  // Excel serial dates are day counts, not instants in the script timezone.
  // Convert using UTC fields so dates like 01/06/2026 do not become 31/05/2026 in America/Sao_Paulo.
  const day = Math.floor(serial + 0.0000001);
  const date = new Date(Date.UTC(1899, 11, 30) + day * 24 * 60 * 60 * 1000);
  return [
    date.getUTCFullYear(),
    pad2_(date.getUTCMonth() + 1),
    pad2_(date.getUTCDate())
  ].join("-");
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
