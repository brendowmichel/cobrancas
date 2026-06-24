const TABLES = {
  CLIENTES: "cobranca_clientes",
  TITULOS: "cobranca_titulos",
  DUPLICIDADES: "cobranca_possiveis_duplicidades",
  LOGS: "cobranca_logs_importacao",
  HISTORICO: "cobranca_historico_status",
  DASHBOARD: "cobranca_dashboard_clientes"
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_API_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variaveis de ambiente.");
  }

  return {
    url: url.replace(/\/+$/, ""),
    key
  };
}

function buildQuery(query) {
  if (!query) return "";
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const text = params.toString();
  return text ? `?${text}` : "";
}

export async function supabaseRequest(resource, options = {}) {
  const config = getSupabaseConfig();
  const method = options.method || "GET";
  const url = `${config.url}/rest/v1/${resource.replace(/^\/+/, "")}${buildQuery(options.query)}`;
  const headers = {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`
  };

  if (options.prefer) headers.Prefer = options.prefer;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store"
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Erro Supabase ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

export function supabaseGet(resource, query) {
  return supabaseRequest(resource, { query });
}

export function supabasePost(resource, body, query, prefer = "return=representation") {
  return supabaseRequest(resource, { method: "POST", body, query, prefer });
}

export function supabasePatch(resource, body, query, prefer = "return=representation") {
  return supabaseRequest(resource, { method: "PATCH", body, query, prefer });
}

export function supabaseUpsert(resource, body, conflictColumns, prefer = "resolution=merge-duplicates,return=minimal") {
  return supabasePost(resource, body, { on_conflict: conflictColumns }, prefer);
}

export { TABLES };

