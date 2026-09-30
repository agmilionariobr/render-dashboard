import * as XLSX from "xlsx";

export function customAttributesToMap(item) {
  const list =
    item.item_details?.custom_attributes;

  if (!Array.isArray(list)) {
    return {};
  }

  const map = {};

  for (const attr of list) {
    if (!attr?.name) continue;

    const value = attr.value;

    map[attr.name] = Array.isArray(value)
      ? value.length
        ? value.join(", ")
        : ""
      : value ?? "";
  }

  return map;
}

export function getAssignedAgentNames(item) {
  const agents =
    item?.assigned_agents;

  if (!Array.isArray(agents)) {
    return [];
  }

  return agents
    .map((agent) => agent?.name)
    .filter(Boolean);
}

export function getItemValue(
  item,
  attrs = null
) {
  const legacyValue =
    item.item_details?.value;

  if (
    legacyValue !== undefined &&
    legacyValue !== null &&
    legacyValue !== ""
  ) {
    return legacyValue;
  }

  const attributes =
    attrs ||
    customAttributesToMap(item);

  return (
    attributes["Valor da Fatura"] ??
    ""
  );
}

export function filterByPeriod(
  items,
  {
    startDate,
    endDate,
  }
) {
  if (
    !startDate &&
    !endDate
  ) {
    return items;
  }

  const start = startDate
    ? new Date(
        `${startDate}T00:00:00`
      ).getTime()
    : -Infinity;

  const end = endDate
    ? new Date(
        `${endDate}T23:59:59.999`
      ).getTime()
    : Infinity;

  return items.filter((item) => {
    const raw =
      item.created_at;

    if (!raw) {
      return true;
    }

    const ts =
      typeof raw === "number"
        ? raw * 1000
        : new Date(raw).getTime();

    return (
      ts >= start &&
      ts <= end
    );
  });
}

export function exportToExcel(
  items,
  columns,
  filename = "export.xlsx"
) {
  const rows =
    items.map((item) => {
      const attrs =
        customAttributesToMap(
          item
        );

      const row = {};

      columns.forEach((col) => {
        row[col.label] =
          col.getValue(
            item,
            attrs
          );
      });

      return row;
    });

  const ws =
    XLSX.utils.json_to_sheet(
      rows
    );

  const wb =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    ws,
    "Exportação"
  );

  ws["!cols"] =
    columns.map((col) => ({
      wch: Math.max(
        col.label.length + 2,
        14
      ),
    }));

  XLSX.writeFile(
    wb,
    filename
  );
}

export const RENDER_EXPORT_COLUMNS = [
  {
    label: "Título",
    getValue: (item) =>
      item.item_details?.title ||
      "",
  },

  {
    label: "Etapa",
    getValue: (item) =>
      item.funnel?.stages?.[
        item.funnel_stage
      ]?.name ||
      item.funnel_stage ||
      "",
  },

  {
    label:
      "Vendedor responsável",
    getValue: (item) =>
      getAssignedAgentNames(
        item
      ).join(", "),
  },

  {
    label: "Valor",
    getValue: (
      item,
      attrs
    ) =>
      getItemValue(
        item,
        attrs
      ),
  },

  {
    label: "Criado em",
    getValue: (item) =>
      formatDate(
        item.created_at
      ),
  },

  {
    label:
      "Data do Prazo",
    getValue: (item) =>
      formatDeadline(
        item.item_details
          ?.deadline_at
      ),
  },

  {
    label:
      "Canal de Aquisição",
    getValue: (
      item,
      attrs
    ) =>
      attrs[
        "Canal de Aquisição"
      ] || "",
  },

  {
    label:
      "Nome do Parceiro",
    getValue: (
      item,
      attrs
    ) =>
      attrs[
        "Nome do Parceiro"
      ] || "",
  },

  {
    label: "Geradora",
    getValue: (
      item,
      attrs
    ) =>
      attrs["Geradora"] || "",
  },

  {
    label: "Distribuidora",
    getValue: (
      item,
      attrs
    ) =>
      attrs[
        "Distribuidora"
      ] || "",
  },

  {
    label:
      "Valor da Fatura",
    getValue: (
      item,
      attrs
    ) =>
      attrs[
        "Valor da Fatura"
      ] ?? "",
  },

  {
    label:
      "Comissão Total",
    getValue: (
      item,
      attrs
    ) =>
      attrs[
        "Comissão Total"
      ] ?? "",
  },

  {
    label:
      "Comissão Vendedor",
    getValue: (
      item,
      attrs
    ) =>
      attrs[
        "Comissão Vendedor"
      ] ?? "",
  },

  {
    label:
      "Comissão Parceiro",
    getValue: (
      item,
      attrs
    ) =>
      attrs[
        "Comissão Parceiro"
      ] ?? "",
  },

  {
    label:
      "Modelo de Pagamento",
    getValue: (
      item,
      attrs
    ) =>
      attrs[
        "Modelo de Pagamento"
      ] || "",
  },
];

function formatDate(raw) {
  if (!raw) return "";

  const date =
    typeof raw === "number"
      ? new Date(raw * 1000)
      : new Date(raw);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(raw);
  }

  return date.toLocaleString(
    "pt-BR"
  );
}

function formatDeadline(raw) {
  if (!raw) return "";

  const date =
    new Date(
      `${String(raw).slice(
        0,
        10
      )}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(raw);
  }

  return date.toLocaleDateString(
    "pt-BR"
  );
}
