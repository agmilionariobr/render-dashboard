import {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";

import {
  listFunnels,
  listAllKanbanItems,
  logout,
} from "../lib/chatwoot";

import {
  filterByPeriod,
  exportToExcel,
  RENDER_EXPORT_COLUMNS,
  customAttributesToMap,
  getAssignedAgentNames,
  getItemValue,
} from "../lib/export";

const B = {
  cyan: "#01c9f0",
  teal: "#07739e",
  navy: "#09092b",
};

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

  if (periodKey === "today") {
    return {
      startDate: end,
      endDate: end,
    };
  }

  if (periodKey === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);

    return {
      startDate: d.toISOString().slice(0, 10),
      endDate: end,
    };
  }

  if (periodKey === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);

    return {
      startDate: d.toISOString().slice(0, 10),
      endDate: end,
    };
  }

  if (periodKey === "month") {
    const d = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    return {
      startDate: d.toISOString().slice(0, 10),
      endDate: end,
    };
  }

  if (periodKey === "custom") {
    return {
      startDate: customStart,
      endDate: customEnd,
    };
  }

  return {
    startDate: null,
    endDate: null,
  };
}

function getAttrsMap(item) {
  return customAttributesToMap(item);
}

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  const normalized = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/^R\$/, "");

  const number = Number(normalized);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
    }
  );
}

function getStageLabel(item) {
  const stage =
    item.funnel?.stages?.[
      item.funnel_stage
    ]?.name;

  if (stage) return stage;

  const raw =
    item.funnel_stage || "Sem etapa";

  const knownStages = {
    fatura: "Fatura",
    follow_up: "Follow up",
    followup: "Follow up",
    em_tratativa: "Em Tratativa",
    proposta: "Proposta",
    reuniao: "Reunião",
    reuni_o: "Reunião",
    negociacao: "Negociação",
    negocia_o: "Negociação",
    subir_proposta: "Subir Proposta",
    contrato: "Contrato",
    stand_by: "Stand-by",
    neg_cio_fechado: "Negócio fechado",
    negocio_fechado: "Negócio fechado",
    neg_cio_perdido: "Negócio perdido",
    negocio_perdido: "Negócio perdido",
  };

  if (knownStages[raw]) {
    return knownStages[raw];
  }

  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) =>
      l.toUpperCase()
    );
}

export default function Dashboard({
  accountId,
  onLogout,
  onSwitchAccount,
  onOpenLeadsReport,
}) {
  const [funnels, setFunnels] =
    useState([]);

  const [funnelId, setFunnelId] =
    useState(null);

  const [items, setItems] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [progress, setProgress] =
    useState(null);

  const [error, setError] =
    useState("");

  const [period, setPeriod] =
    useState("30d");

  const [
    customStart,
    setCustomStart,
  ] = useState("");

  const [
    customEnd,
    setCustomEnd,
  ] = useState("");

  const [exporting, setExporting] =
    useState(false);

  const [
    selectedAgent,
    setSelectedAgent,
  ] = useState("all");

  useEffect(() => {
    listFunnels()
      .then((f) => {
        setFunnels(f);

        if (f.length > 0) {
          setFunnelId(f[0].id);
        }
      })
      .catch((e) =>
        setError(e.message)
      );
  }, []);

  const loadData = useCallback(async () => {
    if (!funnelId) return;

    setLoading(true);
    setError("");

    setProgress({
      stage: "kanban",
      done: 0,
      total: null,
    });

    try {
      const currentFunnel = funnels.find(
        (f) =>
          String(f.id) === String(funnelId)
      );

      if (!currentFunnel) {
        throw new Error(
          "Funil selecionado não encontrado."
        );
      }

      const stages =
        currentFunnel.stages || {};

      const stageIds =
        Object.keys(stages);

      if (stageIds.length === 0) {
        throw new Error(
          "Nenhuma etapa encontrada neste funil."
        );
      }

      const expectedTotal =
        stageIds.reduce(
          (sum, stageId) =>
            sum +
            Number(
              stages[stageId]
                ?.items_count || 0
            ),
          0
        );

      let allItems = [];

      for (const stageId of stageIds) {
        const stageItems =
          await listAllKanbanItems({
            funnelId,
            stageId,
          });

        allItems =
          allItems.concat(stageItems);

        setProgress({
          stage: "kanban",
          done: allItems.length,
          total: expectedTotal,
        });
      }

      const uniqueItems =
        Array.from(
          new Map(
            allItems.map((item) => [
              item.id,
              item,
            ])
          ).values()
        );

      setItems(uniqueItems);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [funnelId, funnels]);

  useEffect(() => {
    if (
      funnelId &&
      funnels.length > 0
    ) {
      loadData();
    }
  }, [
    funnelId,
    funnels,
    loadData,
  ]);

  useEffect(() => {
    setSelectedAgent("all");
  }, [funnelId]);

  const {
    startDate,
    endDate,
  } = periodToRange(
    period,
    customStart,
    customEnd
  );

  const periodFiltered =
    useMemo(
      () =>
        filterByPeriod(items, {
          startDate,
          endDate,
        }),
      [
        items,
        startDate,
        endDate,
      ]
    );

  const availableAgents =
    useMemo(() => {
      const names = new Set();

      items.forEach((item) => {
        getAssignedAgentNames(
          item
        ).forEach((name) =>
          names.add(name)
        );
      });

      return Array.from(
        names
      ).sort((a, b) =>
        a.localeCompare(
          b,
          "pt-BR"
        )
      );
    }, [items]);

  const filtered = useMemo(() => {
    if (
      selectedAgent === "all"
    ) {
      return periodFiltered;
    }

    return periodFiltered.filter(
      (item) =>
        getAssignedAgentNames(
          item
        ).includes(selectedAgent)
    );
  }, [
    periodFiltered,
    selectedAgent,
  ]);

  const summary = useMemo(() => {
    const stages = new Map();

    let totalValue = 0;

    filtered.forEach((item) => {
      const attrs =
        getAttrsMap(item);

      const value = toNumber(
        getItemValue(
          item,
          attrs
        )
      );

      totalValue += value;

      const stageKey =
        item.funnel_stage ||
        "sem_etapa";

      const label =
        getStageLabel(item);

      if (!stages.has(stageKey)) {
        stages.set(stageKey, {
          key: stageKey,
          label,
          count: 0,
          value: 0,
        });
      }

      const stage =
        stages.get(stageKey);

      stage.count += 1;
      stage.value += value;
    });

    return {
      totalCards: filtered.length,
      totalValue,
      stages: Array.from(
        stages.values()
      ),
    };
  }, [filtered]);

  const handleExport = () => {
    setExporting(true);

    try {
      const stamp = new Date()
        .toISOString()
        .slice(0, 10);

      exportToExcel(
        filtered,
        RENDER_EXPORT_COLUMNS,
        `export_render_${stamp}.xlsx`
      );
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

    border: active
      ? `2px solid ${B.cyan}`
      : "1px solid #e2e8f0",

    background: active
      ? "rgba(1,201,240,0.08)"
      : "#fff",

    color: active
      ? B.teal
      : "#64748b",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
      }}
    >
      <header
        style={{
          background: B.navy,
          padding: "14px 24px",
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              color: "#fff",
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            Dashboard de Exportação
          </h1>

          <p
            style={{
              color: B.cyan,
              fontSize: 11,
            }}
          >
            MilionCRM • conta{" "}
            {accountId}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
          }}
        >
          {onOpenLeadsReport && (
            <button
              onClick={
                onOpenLeadsReport
              }
              style={{
                padding:
                  "6px 14px",
                background:
                  "rgba(1,201,240,0.1)",
                color: B.cyan,
                border:
                  "1px solid rgba(1,201,240,0.25)",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Relatório de Leads
            </button>
          )}

          {onSwitchAccount && (
            <button
              onClick={
                onSwitchAccount
              }
              style={{
                padding:
                  "6px 14px",
                background:
                  "rgba(1,201,240,0.1)",
                color: B.cyan,
                border:
                  "1px solid rgba(1,201,240,0.25)",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Trocar empresa
            </button>
          )}

          <button
            onClick={() => {
              logout();
              onLogout();
            }}
            style={{
              padding: "6px 14px",
              background:
                "rgba(239,68,68,0.1)",
              color: "#ef4444",
              border:
                "1px solid rgba(239,68,68,0.2)",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sair
          </button>
        </div>
      </header>

      <div
        style={{
          padding: "20px 24px",
        }}
      >
        {error && (
          <div
            style={{
              background:
                "rgba(239,68,68,0.08)",
              border:
                "1px solid rgba(239,68,68,0.2)",
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
          {funnels.length > 1 && (
            <select
              value={funnelId || ""}
              onChange={(e) =>
                setFunnelId(
                  e.target.value
                )
              }
              style={{
                padding:
                  "8px 12px",
                borderRadius: 8,
                border:
                  "1px solid #e2e8f0",
                fontSize: 13,
              }}
            >
              {funnels.map((f) => (
                <option
                  key={f.id}
                  value={f.id}
                >
                  {f.name}
                </option>
              ))}
            </select>
          )}

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
              Todos os agentes
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

          <div
            style={{
              display: "flex",
              gap: 6,
            }}
          >
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() =>
                  setPeriod(p.key)
                }
                style={btnS(
                  period === p.key
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems:
                  "center",
              }}
            >
              <input
                type="date"
                value={customStart}
                onChange={(e) =>
                  setCustomStart(
                    e.target.value
                  )
                }
                style={{
                  padding:
                    "7px 10px",
                  borderRadius: 8,
                  border:
                    "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              />

              <span
                style={{
                  color: "#94a3b8",
                  fontSize: 13,
                }}
              >
                até
              </span>

              <input
                type="date"
                value={customEnd}
                onChange={(e) =>
                  setCustomEnd(
                    e.target.value
                  )
                }
                style={{
                  padding:
                    "7px 10px",
                  borderRadius: 8,
                  border:
                    "1px solid #e2e8f0",
                  fontSize: 13,
                }}
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
              border:
                "1px solid #e2e8f0",
              color: "#475569",
              cursor: "pointer",
            }}
          >
            Atualizar
          </button>

          <button
            onClick={handleExport}
            disabled={
              loading ||
              exporting ||
              filtered.length === 0
            }
            style={{
              marginLeft: "auto",
              padding:
                "10px 20px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              border: "none",

              cursor:
                filtered.length === 0
                  ? "not-allowed"
                  : "pointer",

              opacity:
                filtered.length === 0
                  ? 0.5
                  : 1,

              background: `linear-gradient(135deg, ${B.cyan}, ${B.teal})`,
              color: "#fff",

              boxShadow:
                "0 2px 8px rgba(1,201,240,0.25)",
            }}
          >
            {exporting
              ? "Gerando..."
              : `Exportar Excel (${filtered.length})`}
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
            {progress?.stage ===
            "kanban"
              ? `Carregando itens do funil... ${progress.done}${
                  progress.total
                    ? ` / ${progress.total}`
                    : ""
                }`
              : "Carregando..."}
          </div>
        )}

        {!loading && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  background: "#fff",
                  border:
                    "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    color: "#64748b",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Total de negócios
                </div>

                <div
                  style={{
                    marginTop: 4,
                    color: B.navy,
                    fontSize: 24,
                    fontWeight: 800,
                  }}
                >
                  {summary.totalCards}
                </div>
              </div>

              <div
                style={{
                  background: "#fff",
                  border:
                    "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    color: "#64748b",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Valor total
                </div>

                <div
                  style={{
                    marginTop: 4,
                    color: B.teal,
                    fontSize: 24,
                    fontWeight: 800,
                  }}
                >
                  {formatCurrency(
                    summary.totalValue
                  )}
                </div>
              </div>
            </div>

            {summary.stages.length >
              0 && (
              <div
                style={{
                  background: "#fff",
                  border:
                    "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: B.navy,
                    marginBottom: 12,
                  }}
                >
                  Resumo por etapa
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                  }}
                >
                  {summary.stages.map(
                    (stage) => (
                      <div
                        key={
                          stage.key
                        }
                        style={{
                          border:
                            "1px solid #e2e8f0",
                          borderRadius: 10,
                          padding:
                            "12px 14px",
                          background:
                            "#f8fafc",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color:
                              "#475569",
                          }}
                        >
                          {stage.label}
                        </div>

                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 13,
                            color:
                              "#64748b",
                          }}
                        >
                          {stage.count}{" "}
                          {stage.count ===
                          1
                            ? "negócio"
                            : "negócios"}
                        </div>

                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 15,
                            fontWeight: 800,
                            color: B.teal,
                          }}
                        >
                          {formatCurrency(
                            stage.value
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border:
                  "1px solid #e2e8f0",
                overflow: "auto",

                boxShadow:
                  "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "#f8fafc",
                    }}
                  >
                    {RENDER_EXPORT_COLUMNS.map(
                      (col) => (
                        <th
                          key={
                            col.label
                          }
                          style={{
                            padding:
                              "10px 12px",
                            textAlign:
                              "left",
                            fontSize: 11,
                            fontWeight: 700,
                            color:
                              "#64748b",
                            textTransform:
                              "uppercase",
                            borderBottom:
                              "2px solid #e2e8f0",
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {col.label}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {filtered.map(
                    (item, idx) => {
                      const attrs =
                        getAttrsMap(
                          item
                        );

                      return (
                        <tr
                          key={
                            item.id ||
                            idx
                          }
                          style={{
                            borderBottom:
                              "1px solid #f1f5f9",
                          }}
                        >
                          {RENDER_EXPORT_COLUMNS.map(
                            (
                              col
                            ) => (
                              <td
                                key={
                                  col.label
                                }
                                style={{
                                  padding:
                                    "8px 12px",
                                  fontSize: 13,
                                  whiteSpace:
                                    "nowrap",
                                }}
                              >
                                {String(
                                  col.getValue(
                                    item,
                                    attrs
                                  ) ??
                                    ""
                                )}
                              </td>
                            )
                          )}
                        </tr>
                      );
                    }
                  )}

                  {filtered.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={
                          RENDER_EXPORT_COLUMNS.length
                        }
                        style={{
                          padding: 40,
                          textAlign:
                            "center",
                          color:
                            "#94a3b8",
                          fontSize: 14,
                        }}
                      >
                        Nenhum item
                        encontrado com
                        os filtros
                        selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
