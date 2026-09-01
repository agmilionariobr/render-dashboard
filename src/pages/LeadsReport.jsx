import { useState, useEffect, useCallback, useMemo } from "react";
import { listAllConversations, logout } from "../lib/chatwoot";
import { groupByDay, filterRowsByPeriod, exportLeadsReport } from "../lib/leadsReport";

const B = { cyan: "#01c9f0", teal: "#07739e", navy: "#09092b" };

export default function LeadsReport({ accountId, onLogout, onSwitchAccount, onBack }) {
  const [inboxId] = useState("78");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setProgress({ done: 0, total: null });
    try {
      const conversations = await listAllConversations({
        inboxId,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setRows(groupByDay(conversations));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [inboxId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(
    () => filterRowsByPeriod(rows, { startDate, endDate }),
    [rows, startDate, endDate]
  );

  const total = filtered.reduce((sum, r) => sum + r.count, 0);

  const handleExport = () => {
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      exportLeadsReport(filtered, `leads_por_dia_${stamp}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

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
          <h1 style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>Relatório de Leads por Dia</h1>
          <p style={{ color: B.cyan, fontSize: 11 }}>MilionCRM • conta {accountId} • inbox {inboxId}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onBack && (
            <button onClick={onBack} style={secondaryBtn(B.cyan)}>
              Voltar
            </button>
          )}
          {onSwitchAccount && (
            <button onClick={onSwitchAccount} style={secondaryBtn(B.cyan)}>
              Trocar empresa
            </button>
          )}
          <button
            onClick={() => {
              logout();
              onLogout();
            }}
            style={secondaryBtn("#ef4444")}
          >
            Sair
          </button>
        </div>
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
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={inputStyle}
            />
            <span style={{ color: "#94a3b8", fontSize: 13 }}>até</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          </div>

          <button onClick={loadData} disabled={loading} style={secondaryBtn("#475569", true)}>
            Atualizar
          </button>

          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
            Total no período: {total} leads
          </span>

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
            {exporting ? "Gerando..." : "Exportar Excel"}
          </button>
        </div>

        {loading && (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            Carregando conversas do inbox... {progress?.done || 0}
            {progress?.total ? ` / ${progress.total}` : ""}
          </div>
        )}

        {!loading && (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              maxWidth: 420,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thStyle}>Data</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Leads</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.date} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={tdStyle}>{formatDateBR(r.date)}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{r.count}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                      Nenhum lead encontrado no período.
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

function formatDateBR(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

const inputStyle = { padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 };
const thStyle = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  borderBottom: "2px solid #e2e8f0",
};
const tdStyle = { padding: "8px 12px", fontSize: 13 };

function secondaryBtn(color, neutral = false) {
  return {
    padding: "6px 14px",
    background: neutral ? "#f1f5f9" : `${color}1a`,
    color,
    border: `1px solid ${neutral ? "#e2e8f0" : `${color}40`}`,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  };
}
