// SISTEMA DE GESTAO DE COBRANCAS - Apps Script v04
// Base em Google Sheets com controle interno por id_interno, hash_identificacao e hash_conteudo.

const APP_VERSION = "v04";

const SHEETS = {
  BASE: "Base_Cobrancas",
  IMPORTACAO: "Importacao",
  DUPLICIDADES: "Possiveis Duplicidades",
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
  const logs = ensureSheet_(ss, SHEETS.LOGS, LOG_HEADERS);
  ensureSheet_(ss, SHEETS.IMPORTACAO, []);

  freezeHeader_(base);
  freezeHeader_(duplicidades);
  freezeHeader_(logs);
  hideTechnicalColumns_(base);

  SpreadsheetApp.getActive().toast("Abas preparadas - " + APP_VERSION, "Cobrancas", 5);
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
      --bg: #f6f7fb;
      --panel: #ffffff;
      --text: #172033;
      --muted: #60708a;
      --line: #d9deea;
      --primary: #1d4ed8;
      --primary-hover: #1e40af;
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
      width: min(760px, calc(100% - 32px));
      margin: 40px auto;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 28px;
      box-shadow: 0 12px 32px rgba(23, 32, 51, 0.08);
    }

    h1 {
      margin: 0 0 8px;
      font-size: 24px;
      line-height: 1.25;
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
      margin-bottom: 20px;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 22px 0;
    }

    .upload {
      display: grid;
      gap: 10px;
      margin: 22px 0;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fbfcff;
    }

    label {
      font-weight: 700;
    }

    input[type="file"] {
      width: 100%;
      min-height: 40px;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
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

    pre {
      min-height: 84px;
      white-space: pre-wrap;
      word-break: break-word;
      background: #f8fafc;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 14px;
      color: var(--muted);
    }

    .ok {
      color: var(--ok);
    }

    .err {
      color: var(--err);
    }
  </style>
</head>
<body>
  <main>
    <span class="version">${APP_VERSION}</span>
    <h1>Sistema de Gestao de Cobrancas</h1>
    <p>Importe o arquivo Excel de cobrancas diretamente por aqui. O sistema le o .xlsx, normaliza os dados e atualiza a base.</p>

    <section class="upload">
      <label for="arquivo-excel">Arquivo Excel</label>
      <input id="arquivo-excel" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
      <button type="button" onclick="importarArquivoExcel()">Importar Excel</button>
    </section>

    <div class="actions">
      <button type="button" class="secondary" onclick="prepararAbas()">Preparar abas</button>
      <button type="button" class="secondary" onclick="importarAbaPadrao()">Importar aba Importacao</button>
    </div>

    <pre id="saida">Aguardando acao.</pre>
  </main>

  <script>
    const saida = document.getElementById("saida");

    function setStatus(texto, classe) {
      saida.className = classe || "";
      saida.textContent = texto;
    }

    function prepararAbas() {
      setStatus("Preparando abas...");
      google.script.run
        .withSuccessHandler(function () {
          setStatus("Abas preparadas com sucesso.", "ok");
        })
        .withFailureHandler(function (erro) {
          setStatus(erro && erro.message ? erro.message : String(erro), "err");
        })
        .setupSistemaCobrancas();
    }

    function importarAbaPadrao() {
      setStatus("Importando aba Importacao...");
      google.script.run
        .withSuccessHandler(function (resumo) {
          const linhas = [
            resumo.registros_lidos + " registros lidos",
            resumo.ja_existiam + " ja existiam",
            resumo.atualizados + " atualizados",
            resumo.novas_cobrancas + " novas cobrancas adicionadas",
            resumo.possiveis_duplicidades + " possiveis duplicidades encontradas",
            resumo.ignorados + " ignorados"
          ];
          setStatus(linhas.join("\\n"), "ok");
        })
        .withFailureHandler(function (erro) {
          setStatus(erro && erro.message ? erro.message : String(erro), "err");
        })
        .importarCobrancasDaAbaPadrao();
    }

    function importarArquivoExcel() {
      const input = document.getElementById("arquivo-excel");
      const arquivo = input.files && input.files[0];

      if (!arquivo) {
        setStatus("Selecione um arquivo Excel antes de importar.", "err");
        return;
      }

      if (!/\\.xlsx$/i.test(arquivo.name)) {
        setStatus("Use um arquivo .xlsx. Se o arquivo estiver em .xls, abra no Excel/Sheets e salve como .xlsx.", "err");
        return;
      }

      setStatus("Lendo arquivo " + arquivo.name + "...");

      const reader = new FileReader();

      reader.onload = function () {
        const dataUrl = String(reader.result || "");
        const base64 = dataUrl.indexOf(",") >= 0 ? dataUrl.split(",")[1] : dataUrl;

        setStatus("Enviando e processando arquivo...");

        google.script.run
          .withSuccessHandler(function (resumo) {
            const linhas = [
              resumo.registros_lidos + " registros lidos",
              resumo.ja_existiam + " ja existiam",
              resumo.atualizados + " atualizados",
              resumo.novas_cobrancas + " novas cobrancas adicionadas",
              resumo.possiveis_duplicidades + " possiveis duplicidades encontradas",
              resumo.ignorados + " ignorados"
            ];
            setStatus(linhas.join("\\n"), "ok");
          })
          .withFailureHandler(function (erro) {
            setStatus(erro && erro.message ? erro.message : String(erro), "err");
          })
          .importarArquivoExcelUpload({
            filename: arquivo.name,
            mimeType: arquivo.type,
            base64: base64
          });
      };

      reader.onerror = function () {
        setStatus("Nao foi possivel ler o arquivo selecionado.", "err");
      };

      reader.readAsDataURL(arquivo);
    }
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
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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

    const obj = rowToObject_(row, BASE_HEADERS);
    const item = { row: r + 1, obj: obj };
    lista.push(item);

    if (obj.hash_identificacao) {
      porHash[obj.hash_identificacao] = item;
    }
  }

  return { lista: lista, porHash: porHash };
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

    const mesmaData = existente.vencimento === registro.vencimento || existente.emissao === registro.emissao;
    const mesmoGrupo = existente.categoria === registro.categoria || existente.numero === registro.numero;

    return mesmaData && mesmoGrupo;
  });
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
    "Mesmo documento com data e categoria/numero semelhantes. Revisar antes de unir ou descartar."
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
  const parts = String(value).split("-");
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
