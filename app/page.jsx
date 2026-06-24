"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  Clipboard,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Upload
} from "lucide-react";

const STATUS_CONTATO = ["EM ABERTO", "EM CONTATO", "AGENDADO", "FINALIZADO"];
const STATUS_CADASTRO = ["", "SUSPENSO", "CANCELADO", "PROTESTADO", "PERMUTA", "DESCONSIDERADO"];

export default function Page() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "valor_total", dir: "desc" });
  const [expanded, setExpanded] = useState({});
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao carregar dashboard.");
      setDashboard(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    const base = dashboard?.inadimplentes || [];
    const filtered = base.filter((item) => {
      const text = `${item.cliente} ${item.cnpj_cpf} ${item.status_cobranca} ${item.status_cadastro}`.toLowerCase();
      return text.includes(search.toLowerCase());
    });

    return filtered.sort((a, b) => {
      const av = a[sort.key] || "";
      const bv = b[sort.key] || "";
      const result = typeof av === "number" || typeof bv === "number"
        ? Number(av || 0) - Number(bv || 0)
        : String(av).localeCompare(String(bv), "pt-BR");
      return sort.dir === "asc" ? result : -result;
    });
  }, [dashboard, search, sort]);

  function changeSort(key) {
    setSort((current) => ({
      key,
      dir: current.key === key && current.dir === "desc" ? "asc" : "desc"
    }));
  }

  function toggle(doc) {
    setExpanded((current) => ({ ...current, [doc]: !current[doc] }));
  }

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 5500);
  }

  async function copySummary(item) {
    const lines = [
      `${item.cliente}`,
      `${formatDocumento(item.cnpj_cpf)}`,
      `${item.duplicatas_vencidas} duplicata(s) vencida(s) - ${currency(item.valor_total)}`,
      "",
      ...item.duplicatas.map((dup) => {
        return `${dup.numero || "Sem numero"} | ${dateBr(dup.vencimento)} | ${dup.dias_atraso} dias | ${dup.categoria || "-"} | ${currency(dup.valor_a_receber)}`;
      })
    ];

    await navigator.clipboard.writeText(lines.join("\n"));
    showToast("Resumo copiado.");
  }

  async function submitStatus(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      cliente: editing.cliente,
      status_cobranca: form.get("status_cobranca"),
      status_cadastro: form.get("status_cadastro"),
      data_agendamento: form.get("data_agendamento"),
      data_status_cadastro: form.get("data_status_cadastro"),
      responsavel: form.get("responsavel"),
      observacao: form.get("observacao")
    };

    const response = await fetch(`/api/clientes/${editing.cnpj_cpf}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      showToast(data.error || "Nao foi possivel salvar.");
      return;
    }
    setEditing(null);
    showToast("Status atualizado.");
    loadDashboard();
  }

  async function importExcel(event) {
    event.preventDefault();
    if (!file) {
      showToast("Selecione um arquivo Excel.");
      return;
    }

    setImporting(true);
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/import", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Importacao falhou.");
      setFile(null);
      event.currentTarget.reset();
      showToast(formatImportSummary(data));
      loadDashboard();
    } catch (err) {
      showToast(err.message);
    } finally {
      setImporting(false);
    }
  }

  const stats = dashboard || {};

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><FileSpreadsheet size={25} /></div>
          <div>
            <h1>Cobrancas</h1>
            <p>
              Atualizado em {dashboard ? dateTimeBr(dashboard.atualizado_em) : "..."} ·{" "}
              {stats.clientes_inadimplentes || 0} inadimplentes · {stats.duplicatas_vencidas || 0} duplicatas ·{" "}
              {stats.maior_atraso || 0} dias de atraso max.
            </p>
          </div>
        </div>
        <div className="top-actions">
          <button className="tonal" onClick={() => window.print()}>Relatorio</button>
          <details className="import-menu">
            <summary className="tonal">
              <Upload size={18} /> Importar <ChevronDown size={16} />
            </summary>
            <form className="import-panel" onSubmit={importExcel}>
              <label>
                Arquivo Excel (.xlsx)
                <input type="file" accept=".xlsx,.xls" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              </label>
              {file && <span className="file-name">{file.name}</span>}
              <button className="primary" disabled={importing}>
                {importing ? <Loader2 className="spin" size={18} /> : <Upload size={18} />}
                {importing ? "Importando..." : "Importar Excel"}
              </button>
            </form>
          </details>
        </div>
      </header>

      <section className="kpis">
        <Kpi label="Total vencido" value={currency(stats.total_vencido)} tone="danger" />
        <Kpi label="Total protestado" value={currency(stats.total_protestado)} tone="muted" />
        <Kpi label="Clientes inadimplentes" value={stats.clientes_inadimplentes || 0} />
        <Kpi label="Maior atraso" value={`${stats.maior_atraso || 0} dias`} />
      </section>

      <section className="card table-card">
        <div className="section-title">
          <div>
            <h2><AlertTriangle size={20} /> Inadimplentes</h2>
            <p>{rows.length} cliente(s) exibidos.</p>
          </div>
          <button className="outline" onClick={loadDashboard} disabled={loading}>
            {loading ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
            Atualizar
          </button>
        </div>

        <label className="search">
          <Search size={21} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar por nome..." />
        </label>

        {error && <div className="error">{error}</div>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th><SortButton label="Nome" field="cliente" sort={sort} changeSort={changeSort} /></th>
                <th>Status</th>
                <th className="center"><SortButton label="Qtd." field="duplicatas_vencidas" sort={sort} changeSort={changeSort} /></th>
                <th className="right"><SortButton label="Valor total" field="valor_total" sort={sort} changeSort={changeSort} /></th>
                <th className="center">Maior atraso</th>
                <th className="actions-col">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="6" className="empty"><Loader2 className="spin" /> Carregando...</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan="6" className="empty">Nenhum inadimplente encontrado.</td></tr>
              )}
              {!loading && rows.map((item) => (
                <Fragment key={item.cnpj_cpf}>
                  <tr key={item.cnpj_cpf} className={isScheduleLate(item) ? "late-row" : ""} onClick={() => toggle(item.cnpj_cpf)}>
                    <td>
                      <strong>{item.cliente}</strong>
                      {item.status_cadastro && <span className={`tag cadastro ${slug(item.status_cadastro)}`}>{item.status_cadastro}</span>}
                      <small>{formatDocumento(item.cnpj_cpf)}</small>
                    </td>
                    <td><StatusCell item={item} /></td>
                    <td className="center">{item.duplicatas_vencidas}</td>
                    <td className="right money">{currency(item.valor_total)}</td>
                    <td className="center">{item.maior_atraso} dias</td>
                    <td className="row-actions" onClick={(event) => event.stopPropagation()}>
                      <button title="Copiar resumo" onClick={() => copySummary(item)}><Clipboard size={18} /></button>
                      <button title="Alterar status" onClick={() => setEditing(item)}><SlidersHorizontal size={18} /></button>
                    </td>
                  </tr>
                  {expanded[item.cnpj_cpf] && (
                    <tr className="detail-row">
                      <td colSpan="6">
                        <table className="detail-table">
                          <thead>
                            <tr>
                              <th>Numero</th>
                              <th>Status</th>
                              <th>Vencimento</th>
                              <th>Atraso</th>
                              <th>Categoria</th>
                              <th className="right">A receber</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.duplicatas.map((dup, index) => (
                              <tr key={`${dup.numero}-${dup.vencimento}-${index}`}>
                                <td>{dup.numero || "-"}</td>
                                <td><span className={`tag cobranca ${slug(dup.status_cobranca)}`}>{dup.status_cobranca}</span></td>
                                <td>{dateBr(dup.vencimento)}</td>
                                <td>{dup.dias_atraso} dias</td>
                                <td>{dup.categoria || "-"}</td>
                                <td className="right money">{currency(dup.valor_a_receber)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submitStatus}>
            <h2>Atualizar status</h2>
            <p>{editing.cliente}</p>
            <label>Status de contato
              <select name="status_cobranca" defaultValue={editing.status_cobranca || "EM ABERTO"}>
                {STATUS_CONTATO.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label>Status de cadastro
              <select name="status_cadastro" defaultValue={editing.status_cadastro || ""}>
                {STATUS_CADASTRO.map((status) => <option key={status} value={status}>{status || "Sem status"}</option>)}
              </select>
            </label>
            <div className="grid-2">
              <label>Agendamento
                <input name="data_agendamento" type="date" defaultValue={editing.data_agendamento || ""} />
              </label>
              <label>Data cadastro
                <input name="data_status_cadastro" type="date" defaultValue={editing.data_status_cadastro || ""} />
              </label>
            </div>
            <label>Responsavel
              <input name="responsavel" defaultValue={editing.responsavel || ""} />
            </label>
            <label>Observacao
              <textarea name="observacao" rows="4" defaultValue={editing.observacao || ""} />
            </label>
            <div className="modal-actions">
              <button type="button" className="outline" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="primary"><Save size={18} /> Salvar</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <article className={`card kpi ${tone || ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SortButton({ label, field, sort, changeSort }) {
  return (
    <button className="sort" onClick={() => changeSort(field)}>
      {label} {sort.key === field ? (sort.dir === "desc" ? "v" : "^") : ""}
    </button>
  );
}

function StatusCell({ item }) {
  const label = isScheduleLate(item) ? "AG. VENCIDO" : item.status_cobranca || "EM ABERTO";
  return (
    <div className="status-cell">
      <span className={`tag contato ${slug(label)}`}>{label}</span>
      {item.data_agendamento && <span className="date-inline"><CalendarClock size={14} /> {dateBr(item.data_agendamento)}</span>}
      {item.observacao && <small title={item.observacao}>{item.observacao}</small>}
    </div>
  );
}

function isScheduleLate(item) {
  if ((item.status_cobranca || "") !== "AGENDADO" || !item.data_agendamento) return false;
  return item.data_agendamento < new Date().toISOString().slice(0, 10);
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function currency(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateBr(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function dateTimeBr(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR");
}

function formatDocumento(value) {
  const doc = String(value || "").replace(/\D/g, "");
  if (doc.length === 14) return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (doc.length === 11) return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return value || "";
}

function formatImportSummary(data) {
  return [
    `${data.registros_lidos || 0} registros lidos`,
    `${data.ja_existiam || 0} ja existiam`,
    `${data.atualizados || 0} atualizados`,
    `${data.novas_cobrancas || 0} novas cobrancas adicionadas`,
    `${data.possiveis_duplicidades || 0} possiveis duplicidades encontradas`,
    `${data.ignorados || 0} ignorados`
  ].join("\n");
}
