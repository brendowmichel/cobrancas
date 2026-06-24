// SISTEMA DE GESTAO DE COBRANCAS - Apps Script v01
// Base em Google Sheets com controle interno por id_interno, hash_identificacao e hash_conteudo.

const APP_VERSION = "v01";

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
    throw new Error("Ative o servico avancado do Google Drive no Apps Script para usar importarXlsxDoDrive(fileId).");
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
    Drive.Files.trash(convertido.id);
  }
}

function importarCobrancasDeSheet_(origemSheet, origemArquivo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const baseSheet = ss.getSheetByName(SHEETS.BASE);
  const duplicidadesSheet = ss.getSheetByName(SHEETS.DUPLICIDADES);
  const logsSheet = ss.getSheetByName(SHEETS.LOGS);

  const importacao = lerRegistrosOrigem_(origemSheet);
  const base = carregarBase_(baseSheet);
  const now = new Date();
  const nowText = formatDateTime_(now);

  const resumo = {
    versao: APP_VERSION,
    origem_arquivo: origemArquivo,
    aba_origem: origemSheet.getName(),
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
    origemSheet.getName(),
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

function lerRegistrosOrigem_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) return { registros: [], ignorados: 0 };

  const headerInfo = detectarCabecalho_(values);
  if (!headerInfo) {
    throw new Error("Nao foi possivel detectar o cabecalho da aba " + sheet.getName());
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
