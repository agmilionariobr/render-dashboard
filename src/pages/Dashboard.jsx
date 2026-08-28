import { useState, useEffect, useMemo, useCallback } from "react";
import { listFunnels, listAllKanbanItems, logout } from "../lib/chatwoot";
import { enrichItemsWithCustomAttributes, filterByPeriod, exportToExcel, RENDER_EXPORT_COLUMNS } from "../lib/export";

const B = { cyan: "#01c9f0", teal: "#07739e", navy: "#09092b" };

const PERIODS = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "month", label: "Este mês" },
  { key: "custom", label: "Personalizado" },
];

function periodToRange(periodKey, customStart, customEnd) {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  if (periodKey === "today") return { startDate: end, endDate: end };
  if (periodKey === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { startDate: d.toISOString().slice(0, 10), endDate: end };
  }
  if (periodKey === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return { startDate: d.toISOString().slice(0, 10), endDate: end };
  }
  if (periodKey === "month") {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: d.toISOString().slice(0, 10), endDate: end };
  }
  if (periodKey === "custom") return { startDate: customStart, endDate: customEnd };
  return { startDate: null, endDate: null };
}

export default function Dashboard({ accountId, onLogout }) {
  const [funnels, setFunnels] = useState([]);
  const [funnelId, setFunnelId] = useState(null);
  const [rawItems, setRawItems] = useState([]);
  const [enrichedItems, setEnrichedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    listFunnels()
      .then((f) => {
        setFunnels(f);
        if (f.length > 0) setFunnelId(f[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  const loadData = useCallback(async () => {
    if (!funnelId) return;
    setLoading(true);
    setError("");
    setProgress({ stage: "kanban", done: 0, total: null });
    try {
      const items = await listAllKanbanItems({
        funnelId,
        onProgress: (done, total) => setProgress({ stage: "kanban", done, total }),
      });
      setRawItems(items);

      setProgress({ stage: "attrs", done: 0, total: items.length });
      const enriched = await enrichItemsWithCustomAttributes(items, {
        onProgress: (done, total) => setProgress({ stage: "attrs", done, total }),
      });
      setEnrichedItems(enriched);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [funnelId]);

  useEffect(() => {
    if (funnelId) loadData();
  }, [funnelId, loadData]);

  const { startDate, endDate } = periodToRange(period, customStart, customEnd);
  const filtered = useMemo(
    () => filterByPeriod(enrichedItems, { startDate, endDate }),
    [enrichedItems, startDate, endDate]
  );

  const handleExport = () => {
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      exportToExcel(filtered, RENDER_EXPORT_COLUMNS, `export_render_${stamp}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  const btnS = (active) => ({
    padding: "8px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    border: active ? `2px solid ${B.cyan}` : "1px solid #e2e8f0",
    background: active ? "rgba(1,201,240,0.08)" : "#fff",
    color: active ? B.teal : "#64748b",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <header
        style={{
          background: B.navy,
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>Dashboard de Exportação</h1>
          <p style={{ color: B.cyan, fontSize: 11 }}>MilionCRM • conta {accountId}</p>
        </div>
        <button
          onClick={() => {
            logout();
            onLogout();
          }}
          style={{
            padding: "6px 14px",
            background: "rgba(239,68,68,0.1)",
            color: "#ef4444",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sair
        </button>
      </header>

      <div style={{ padding: "20px 24px" }}>
        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 16,
              color: "#ef4444",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          {funnels.length > 1 && (
            <select
              value={funnelId || ""}
              onChange={(e) => setFunnelId(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
            >
              {funnels.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={btnS(period === p.key)}>
                {p.label}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
              />
              <span style={{ color: "#94a3b8", fontSize: 13 }}>até</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
              />
            </div>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: "#f1f5f9",
              border: "1px solid #e2e8f0",
              color: "#475569",
              cursor: "pointer",
            }}
          >
            🔄 Atualizar
          </button>

          <button
            onClick={handleExport}
            disabled={loading || exporting || filtered.length === 0}
            style={{
              marginLeft: "auto",
              padding: "10px 20px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              cursor: filtered.length === 0 ? "not-allowed" : "pointer",
              opacity: filtered.length === 0 ? 0.5 : 1,
              background: `linear-gradient(135deg, ${B.cyan}, ${B.teal})`,
              color: "#fff",
              boxShadow: "0 2px 8px rgba(1,201,240,0.25)",
            }}
          >
            {exporting ? "Gerando..." : `⬇ Exportar Excel (${filtered.length})`}
          </button>
        </div>

        {loading && (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            {progress?.stage === "kanban"
              ? `Carregando itens do funil... ${progress.done}${progress.total ? ` / ${progress.total}` : ""}`
              : progress?.stage === "attrs"
              ? `Buscando campos customizados... ${progress.done} / ${progress.total}`
              : "Carregando..."}
          </div>
        )}

        {!loading && (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              overflow: "auto",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {RENDER_EXPORT_COLUMNS.map((col) => (
                    <th
                      key={col.label}
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#64748b",
                        textTransform: "uppercase",
                        borderBottom: "2px solid #e2e8f0",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr key={item.id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    {RENDER_EXPORT_COLUMNS.map((col) => (
                      <td key={col.label} style={{ padding: "8px 12px", fontSize: 13, whiteSpace: "nowrap" }}>
                        {String(col.getValue(item) ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={RENDER_EXPORT_COLUMNS.length}
                      style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}
                    >
                      Nenhum item encontrado no período selecionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
