import { useState, useEffect, useMemo } from "react";
import { listAllConversations, logout } from "../lib/chatwoot";
import {
  groupByDay,
  filterRowsByPeriod,
  exportLeadsReport,
} from "../lib/leadsReport";

const B = { cyan: "#01c9f0", teal: "#07739e", navy: "#09092b" };

const INBOXES = [
  {
    id: "78",
    name: "(11)947376974",
    filename: "troca_game_inbox_78",
  },
  {
    id: "25",
    name: "Trog IA — (11) 93618-7951",
    filename: "trog_ia_inbox_25",
  },
];

export default function LeadsReport({
  accountId,
  onLogout,
  onSwitchAccount,
  onBack,
}) {
  const [inboxId, setInboxId] = useState("78");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const selectedInbox = INBOXES.find((inbox) => inbox.id === inboxId);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");
      setResult(null);
      setProgress({ done: 0, total: null });

      try {
        const conversations = await listAllConversations({
          inboxId,
          onProgress: (done, total) => {
            if (active) setProgress({ done, total });
          },
        });

        if (!active) return;

        setResult({
          accountId,
          inboxId,
          rows: groupByDay(conversations),
        });
      } catch (e) {
        if (active) {
          setError(e.message || "Não foi possível carregar as conversas.");
        }
      } finally {
        if (active) {
          setLoading(false);
          setProgress(null);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [accountId, inboxId, reloadKey]);

  const ready =
    !loading &&
    !error &&
    result?.accountId === accountId &&
    result?.inboxId === inboxId;

  const filtered = useMemo(() => {
    if (!ready) return [];

    return filterRowsByPeriod(result.rows, {
      startDate,
      endDate,
    });
  }, [ready, result, startDate, endDate]);

  const total = filtered.reduce((sum, row) => sum + row.count, 0);
  const canExport = ready && !exporting && filtered.length > 0;

  const handleInboxChange = (event) => {
    setLoading(true);
    setError("");
    setResult(null);
    setProgress(null);
    setInboxId(event.target.value);
  };

  const handleRefresh = () => {
    setLoading(true);
    setError("");
    setResult(null);
    setProgress(null);
    setReloadKey((value) => value + 1);
  };

  const handleExport = () => {
    if (!canExport) return;

    setExporting(true);

    try {
      const stamp = new Date().toISOString().slice(0, 10);
      exportLeadsReport(
        filtered,
        `leads_por_dia_${selectedInbox.filename}_${stamp}.xlsx`
      );
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
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>
            Relatório de Leads por Dia
          </h1>
          <p style={{ color: B.cyan, fontSize: 11 }}>
            MilionCRM • conta {accountId} • inbox {inboxId}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onBack && (
            <button onClick={onBack} style={secondaryBtn(B.cyan)}>
              Voltar
            </button>
          )}

          {onSwitchAccount && (
            <button
              onClick={onSwitchAccount}
              style={secondaryBtn(B.cyan)}
            >
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
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="leads-inbox"
            style={{
              display: "block",
              marginBottom: 6,
              color: "#475569",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Canal de atendimento
          </label>

          <select
            id="leads-inbox"
            value={inboxId}
            onChange={handleInboxChange}
            disabled={loading}
            style={{
              ...inputStyle,
              width: "100%",
              maxWidth: 340,
              background: "#fff",
              color: "#0f172a",
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {INBOXES.map((inbox) => (
              <option key={inbox.id} value={inbox.id}>
                {inbox.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div
            role="alert"
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

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="date"
              aria-label="Data inicial"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={inputStyle}
            />
            <span style={{ color: "#94a3b8", fontSize: 13 }}>até</span>
            <input
              type="date"
              aria-label="Data final"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            style={secondaryBtn("#475569", true)}
          >
            Atualizar
          </button>

          <span
            style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}
          >
            {loading
              ? "Carregando dados..."
              : ready
                ? `Total no período: ${total} leads`
                : "Dados indisponíveis"}
          </span>

          <button
            onClick={handleExport}
            disabled={!canExport}
            style={{
              marginLeft: "auto",
              padding: "10px 20px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              cursor: canExport ? "pointer" : "not-allowed",
              opacity: canExport ? 1 : 0.5,
              background: `linear-gradient(135deg, ${B.cyan}, ${B.teal})`,
              color: "#fff",
              boxShadow: "0 2px 8px rgba(1,201,240,0.25)",
            }}
          >
            {exporting ? "Gerando..." : "Exportar Excel"}
          </button>
        </div>

        {loading && (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            Carregando conversas de {selectedInbox.name}...{" "}
            {progress?.done || 0}
            {progress?.total ? ` / ${progress.total}` : ""}
          </div>
        )}

        {ready && (
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
                {filtered.map((row) => (
                  <tr
                    key={row.date}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                  >
                    <td style={tdStyle}>{formatDateBR(row.date)}</td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        fontWeight: 600,
                      }}
                    >
                      {row.count}
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      style={{
                        padding: 40,
                        textAlign: "center",
                        color: "#94a3b8",
                        fontSize: 14,
                      }}
                    >
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

const inputStyle = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 13,
};

const thStyle = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  borderBottom: "2px solid #e2e8f0",
};

const tdStyle = {
  padding: "8px 12px",
  fontSize: 13,
};

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
