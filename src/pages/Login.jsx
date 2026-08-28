import { useState } from "react";
import { login } from "../lib/chatwoot";

const BRAND = {
  bg: "#09092b",
  bgCard: "#12124a",
  cyan: "#01c9f0",
  blue: "#07739e",
  text: "#e9eefc",
  muted: "#94a3b8",
};

export default function Login({ onLogged }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      const auth = await login(email.trim(), password);
      onLogged(auth);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        background: BRAND.bg,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ color: BRAND.text, fontSize: 24, fontWeight: 700 }}>
            Dashboard de Exportação
          </h1>
          <p style={{ color: BRAND.muted, fontSize: 13, marginTop: 6 }}>
            Acesso via MilionCRM
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              borderRadius: 16,
              padding: "14px 20px",
              outline: "none",
              background: BRAND.bgCard,
              color: BRAND.text,
              border: `1px solid rgba(1,201,240,0.15)`,
              fontSize: 14,
            }}
          />

          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              style={{
                width: "100%",
                borderRadius: 16,
                padding: "14px 48px 14px 20px",
                outline: "none",
                background: BRAND.bgCard,
                color: BRAND.text,
                border: `1px solid rgba(1,201,240,0.15)`,
                fontSize: 14,
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: showPassword ? BRAND.cyan : BRAND.muted,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {showPassword ? "ocultar" : "mostrar"}
            </button>
          </div>

          {error && (
            <p style={{ color: "#ff6b6b", fontSize: 13, textAlign: "center" }}>
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={loading}
            style={{
              width: "100%",
              fontWeight: 600,
              borderRadius: 999,
              padding: "14px",
              border: "none",
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
              background: `linear-gradient(135deg, ${BRAND.cyan}, ${BRAND.blue})`,
              color: BRAND.bg,
              fontSize: 14,
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </div>

        <p style={{ fontSize: 12, textAlign: "center", marginTop: 24, color: BRAND.muted }}>
          Use seu login e senha do MilionCRM
        </p>
      </div>
    </div>
  );
}
