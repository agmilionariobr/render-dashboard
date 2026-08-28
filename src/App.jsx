import { useState, useEffect } from "react";
import { getAuth, getAccounts, clearAuth } from "./lib/chatwoot";
import Login from "./pages/Login";
import AccountSelect from "./pages/AccountSelect";
import Dashboard from "./pages/Dashboard";

const B = { navy: "#09092b", cyan: "#01c9f0" };

export default function App() {
  const [auth, setAuth] = useState(null);
  const [accountId, setAccountId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const a = getAuth();
    if (a?.accessToken) {
      setAuth(a);
      setAccountId(a.accountId || null);
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    clearAuth();
    setAuth(null);
    setAccountId(null);
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: B.navy,
        }}
      >
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Carregando...</p>
      </div>
    );
  }

  if (!auth) {
    return (
      <Login
        onLogged={(a) => {
          setAuth(a);
          setAccountId(a.accountId || null);
        }}
      />
    );
  }

  const accounts = getAccounts();
  if (!accountId && accounts.length > 1) {
    return <AccountSelect onSelect={(id) => setAccountId(id)} onLogout={handleLogout} />;
  }

  if (!accountId) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#94a3b8" }}>Nenhuma empresa disponível para este usuário.</p>
      </div>
    );
  }

  return <Dashboard accountId={accountId} onLogout={handleLogout} />;
}
