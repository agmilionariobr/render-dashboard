import { getAccounts, setActiveAccount, getAuth } from "../lib/chatwoot";

const BRAND = { bg: "#09092b", cyan: "#01c9f0", blue: "#07739e", text: "#e9eefc", muted: "#94a3b8" };

function initials(name) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function colorForName(name) {
  const colors = ["#01c9f0", "#07739e", "#059669", "#d97706", "#7c3aed", "#dc2626"];
  let hash = 0;
  for (const c of name || "") hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function AccountSelect({ onSelect, onLogout }) {
  const accounts = [...getAccounts()].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", "pt-BR")
  );
  const auth = getAuth();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <div style={{ background: BRAND.bg, padding: "24px 20px" }}>
        <h1 style={{ color: BRAND.text, fontSize: 18, fontWeight: 600 }}>Escolha a empresa</h1>
        <p style={{ color: BRAND.muted, fontSize: 13, marginTop: 4 }}>
          {auth?.name} • {auth?.email}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {accounts.map((acc) => {
          const name = acc.name || `Conta ${acc.id}`;
          return (
            <button
              key={acc.id}
              onClick={() => {
                setActiveAccount(acc.id);
                onSelect(acc.id);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 20px",
                background: "#fff",
                border: "none",
                borderBottom: "1px solid #f1f5f9",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  flexShrink: 0,
                  background: colorForName(name),
                }}
              >
                {initials(name)}
              </div>
              <div>
                <p style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{name}</p>
                {acc.role && (
                  <p style={{ fontSize: 12, color: "#94a3b8", textTransform: "capitalize" }}>
                    {acc.role === "administrator" ? "Administrador" : "Agente"}
                  </p>
                )}
              </div>
            </button>
          );
        })}
        {accounts.length === 0 && (
          <p style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>
            Nenhuma empresa encontrada para este usuário.
          </p>
        )}
      </div>

      <div style={{ padding: 16, borderTop: "1px solid #e2e8f0" }}>
        <button
          onClick={onLogout}
          style={{
            width: "100%",
            background: "none",
            border: "none",
            color: "#94a3b8",
            fontSize: 13,
            padding: 10,
            cursor: "pointer",
          }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}
