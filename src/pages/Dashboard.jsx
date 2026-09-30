<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
  }}
>
  <span
    style={{
      fontSize: 13,
      fontWeight: 700,
      color: "#475569",
      whiteSpace: "nowrap",
    }}
  >
    Vendedor:
  </span>

  <select
    value={selectedAgent}
    onChange={(e) =>
      setSelectedAgent(
        e.target.value
      )
    }
    style={{
      padding: "8px 12px",
      borderRadius: 8,
      border:
        "1px solid #e2e8f0",
      fontSize: 13,
      background: "#fff",
      minWidth: 180,
    }}
  >
    <option value="all">
      Todos os vendedores
    </option>

    {availableAgents.map(
      (agent) => (
        <option
          key={agent}
          value={agent}
        >
          {agent}
        </option>
      )
    )}
  </select>
</div>
