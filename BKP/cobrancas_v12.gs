// SISTEMA DE GESTAO DE COBRANCAS - Apps Script v12
// Base em Google Sheets com controle interno por id_interno, hash_identificacao e hash_conteudo.

const APP_VERSION = "v12";

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
  "tipo_status",
  "responsavel",
  "observacao",
  "data_primeira_importacao",
  "data_ultima_importacao",
  "origem_arquivo",
  "ativo_na_ultima_importacao"
];

const STATUS_CONTATO_CLIENTE = ["EM ABERTO", "EM CONTATO", "AGENDADO"];
const STATUS_CADASTRO_CLIENTE = ["SUSPENSO", "CANCELADO", "PROTESTADO"];
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

  if (!baseSheet) {
    return {
      atualizado_em: formatDateTime_(new Date()),
      kpis: kpisVazios_(),
      inadimplentes: [],
      proximos_vencimentos: [],
      sugestoes: []
    };
  }

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

  const inadimplentes = Object.keys(grupos).map(function (key) {
    const grupo = grupos[key];
    grupo.duplicatas_vencidas = grupo.duplicatas.length;
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
      clientes_inadimplentes: inadimplentes.length,
      duplicatas_vencidas: qtdVencidas,
      duplicatas_abertas: qtdAbertas,
      vence_7_dias: 0,
      maior_atraso: maiorAtraso
    },
    inadimplentes: inadimplentes.slice(0, 200),
    proximos_vencimentos: [],
    sugestoes: []
  };
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
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f6f9;
      --panel: #ffffff;
      --text: #172033;
      --muted: #60708a;
      --line: #d9deea;
      --primary: #1d4ed8;
      --primary-hover: #1e40af;
      --soft: #eef3fb;
      --warn: #b45309;
      --ok: #166534;
      --err: #991b1b;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: var(--bg);
      color: var(--text);
    }

    main {
      width: min(1220px, calc(100% - 32px));
      margin: 24px auto 40px;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }

    h1, h2, h3 {
      margin: 0;
    }

    h1 {
      font-size: 24px;
      line-height: 1.25;
    }

    h2 {
      font-size: 17px;
    }

    h3 {
      font-size: 15px;
    }

    p {
      margin: 0 0 16px;
      color: var(--muted);
      line-height: 1.5;
    }

    .version {
      display: inline-flex;
      align-items: center;
      height: 28px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--muted);
      font-size: 13px;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 10px 26px rgba(23, 32, 51, 0.06);
    }

    .panel-pad {
      padding: 18px;
    }

    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .kpi {
      padding: 16px;
    }

    .kpi span {
      display: block;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
    }

    .kpi strong {
      display: block;
      margin-top: 8px;
      font-size: 24px;
      line-height: 1.1;
    }

    .layout {
      display: block;
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }

    .toolbar-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .upload {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }

    label {
      font-weight: 700;
      font-size: 13px;
    }

    input[type="file"] {
      width: 100%;
      min-height: 40px;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
    }

    details {
      margin-bottom: 16px;
    }

    summary {
      cursor: pointer;
      color: var(--primary);
      font-weight: 700;
    }

    button {
      border: 0;
      border-radius: 6px;
      background: var(--primary);
      color: #fff;
      min-height: 40px;
      padding: 0 14px;
      font-weight: 700;
      cursor: pointer;
    }

    button.small {
      min-height: 32px;
      padding: 0 10px;
      font-size: 12px;
    }

    button:hover {
      background: var(--primary-hover);
    }

    button.secondary {
      background: #e8edf7;
      color: var(--text);
    }

    button.secondary:hover {
      background: #dce4f2;
    }

    .sort-btn {
      display: inline-flex;
      align-items: center;
      justify-content: inherit;
      gap: 4px;
      min-height: 24px;
      padding: 0;
      border-radius: 0;
      background: transparent;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
    }

    .sort-btn:hover {
      background: transparent;
      color: var(--primary);
    }

    .sort-mark {
      display: inline-block;
      width: 12px;
      text-align: center;
      color: var(--primary);
    }

    .actions {
      text-align: right;
      white-space: nowrap;
    }

    .table-wrap {
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 620px;
    }

    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      font-size: 13px;
      vertical-align: middle;
    }

    th {
      background: #f8fafc;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
    }

    tbody tr {
      cursor: pointer;
    }

    tbody tr.cliente-row:hover {
      background: #f9fbff;
    }

    tbody tr.expanded-row {
      cursor: default;
      background: #fbfcff;
    }

    .detail-cell {
      padding: 0;
      background: #fbfcff;
    }

    .num {
      text-align: right;
      white-space: nowrap;
    }

    .muted {
      color: var(--muted);
    }

    .status-line {
      color: var(--muted);
      font-size: 13px;
      margin-top: 8px;
      min-height: 20px;
    }

    .detail-head {
      display: grid;
      gap: 4px;
      margin-bottom: 14px;
    }

    .detail-list {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }

    .inline-detail {
      padding: 16px;
      border-top: 1px solid var(--line);
    }

    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border-radius: 999px;
      padding: 0 8px;
      background: var(--soft);
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }

    .detail-table {
      min-width: 760px;
    }

    .detail-table tbody tr {
      cursor: default;
    }

    .detail-table tbody tr:hover {
      background: transparent;
    }

    #toast-area {
      position: fixed;
      right: 18px;
      bottom: 18px;
      display: grid;
      gap: 10px;
      z-index: 20;
      width: min(420px, calc(100vw - 36px));
    }

    .toast {
      white-space: pre-wrap;
      border-radius: 8px;
      padding: 14px;
      border: 1px solid var(--line);
      background: #fff;
      box-shadow: 0 14px 32px rgba(23, 32, 51, 0.18);
      color: var(--text);
    }

    .ok {
      color: var(--ok);
    }

    .err {
      color: var(--err);
    }

    .warn {
      color: var(--warn);
    }

    [hidden] {
      display: none !important;
    }

    @media (max-width: 860px) {
      header, .toolbar {
        align-items: flex-start;
        flex-direction: column;
      }

      .kpis {
        grid-template-columns: 1fr;
      }

      main {
        width: min(100% - 20px, 1220px);
        margin-top: 14px;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Dashboard de Cobrancas</h1>
        <p id="subtitulo">Carregando dados da base...</p>
      </div>
      <span class="version">${APP_VERSION}</span>
    </header>

    <section class="kpis">
      <div class="panel kpi"><span>Total vencido</span><strong id="kpi-vencido">R$ 0,00</strong></div>
      <div class="panel kpi"><span>Clientes inadimplentes</span><strong id="kpi-clientes">0</strong></div>
      <div class="panel kpi"><span>Duplicatas vencidas</span><strong id="kpi-duplicatas">0</strong></div>
      <div class="panel kpi"><span>Maior atraso</span><strong id="kpi-atraso">0 dias</strong></div>
    </section>

    <details class="panel panel-pad">
      <summary>Importacao</summary>
      <div class="upload">
        <label for="arquivo-excel">Arquivo Excel (.xlsx)</label>
        <input id="arquivo-excel" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
        <div class="toolbar-actions">
          <button type="button" onclick="importarArquivoExcel()">Importar Excel</button>
          <button type="button" class="secondary" onclick="importarAbaPadrao()">Importar aba Importacao</button>
          <button id="btn-preparar" type="button" class="secondary" onclick="prepararAbas()" hidden>Preparar abas</button>
        </div>
        <div id="import-status" class="status-line"></div>
      </div>
    </details>

    <section class="layout panel panel-pad">
      <div class="toolbar">
        <div>
          <h2>Inadimplentes</h2>
          <div class="muted" id="lista-info">Clique em um cliente para abrir as duplicatas vencidas.</div>
        </div>
        <div class="toolbar-actions">
          <button type="button" class="secondary small" onclick="carregarDashboard()">Atualizar</button>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th><button type="button" class="sort-btn" onclick="ordenarInadimplentes('cliente')">Nome <span id="sort-cliente" class="sort-mark"></span></button></th>
              <th class="num"><button type="button" class="sort-btn" onclick="ordenarInadimplentes('duplicatas_vencidas')">Duplicatas vencidas <span id="sort-duplicatas_vencidas" class="sort-mark"></span></button></th>
              <th class="num"><button type="button" class="sort-btn" onclick="ordenarInadimplentes('valor_total')">Valor total <span id="sort-valor_total" class="sort-mark"></span></button></th>
              <th class="num">Maior atraso</th>
              <th class="actions">Acoes</th>
            </tr>
          </thead>
          <tbody id="inadimplentes-body">
            <tr><td colspan="5" class="muted">Carregando...</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>

  <div id="toast-area"></div>

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
      return [
        resumo.registros_lidos + " registros lidos",
        resumo.ja_existiam + " ja existiam",
        resumo.atualizados + " atualizados",
        resumo.novas_cobrancas + " novas cobrancas adicionadas",
        resumo.possiveis_duplicidades + " possiveis duplicidades encontradas",
        resumo.ignorados + " ignorados"
      ].join("\\n");
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
      document.getElementById("kpi-vencido").textContent = moeda.format(kpis.total_vencido || 0);
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
        body.innerHTML = '<tr><td colspan="5" class="muted">Nenhum inadimplente encontrado.</td></tr>';
        return;
      }

      lista.forEach(function (item) {
        const tr = document.createElement("tr");
        tr.className = "cliente-row";
        tr.dataset.id = item.id;
        tr.innerHTML =
          "<td><strong>" + escapeHtml(item.cliente) + "</strong><br><span class='muted'>" + escapeHtml(item.cnpj_cpf) + "</span></td>" +
          "<td class='num'>" + item.duplicatas_vencidas + "</td>" +
          "<td class='num'><strong>" + moeda.format(item.valor_total || 0) + "</strong></td>" +
          "<td class='num'>" + (item.maior_atraso || 0) + " dias</td>" +
          "<td class='actions'><button type='button' class='secondary small' onclick='copiarResumoCliente(&quot;" + escapeAttr(item.id) + "&quot;, event)'>Copiar resumo</button></td>";
        tr.addEventListener("click", function () {
          toggleDetalheCliente(item);
        });
        body.appendChild(tr);

        const detailTr = document.createElement("tr");
        detailTr.className = "expanded-row";
        detailTr.dataset.detailFor = item.id;
        detailTr.hidden = true;
        detailTr.innerHTML = "<td colspan='5' class='detail-cell'>" + detalheClienteHtml(item) + "</td>";
        body.appendChild(detailTr);
      });
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
        return "<tr>" +
          "<td><strong>" + escapeHtml(dup.numero || "Sem numero") + "</strong></td>" +
          "<td><span class='pill'>" + escapeHtml(dup.status_cobranca || "VENCIDO") + "</span></td>" +
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
          return "- " + (dup.numero || "Sem numero") + " | venc. " + formatDateBR(dup.vencimento) + " | " + moeda.format(dup.valor_a_receber || 0);
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

  if (importacao.registros.length) {
    base.lista.forEach(function (item) {
      const hash = item.obj.hash_identificacao;
      if (item.row && hash && !hashesImportadas[hash] && item.obj.ativo_na_ultima_importacao !== "NAO") {
        const updated = Object.assign({}, item.obj, { ativo_na_ultima_importacao: "NAO" });
        atualizacoes.push({ row: item.row, values: toBaseRow_(updated) });
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
      const status = normalizarStatusCliente_(atual.status_cobranca);
      const merged = {
        cnpj_cpf: documento,
        cliente: registro.cliente || atual.cliente || "",
        status_cobranca: status,
        tipo_status: statusClienteTipo_(status),
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
        tipo_status: statusClienteTipo_(STATUS_CLIENTE_PADRAO),
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
        const status = normalizarStatusCliente_(item.obj.status_cobranca);
        const updated = {
          cnpj_cpf: documento,
          cliente: item.obj.cliente || "",
          status_cobranca: status,
          tipo_status: statusClienteTipo_(status),
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
  normalized.tipo_status = statusClienteTipo_(normalized.status_cobranca);
  normalized.responsavel = normalizeText_(normalized.responsavel);
  normalized.observacao = normalizeText_(normalized.observacao);
  normalized.ativo_na_ultima_importacao = normalizeText_(normalized.ativo_na_ultima_importacao);
  return normalized;
}

function normalizarStatusCliente_(status) {
  const normalized = normalizeText_(status);
  if (STATUS_CONTATO_CLIENTE.indexOf(normalized) >= 0) return normalized;
  if (STATUS_CADASTRO_CLIENTE.indexOf(normalized) >= 0) return normalized;
  return STATUS_CLIENTE_PADRAO;
}

function statusClienteTipo_(status) {
  const normalized = normalizarStatusCliente_(status);
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
