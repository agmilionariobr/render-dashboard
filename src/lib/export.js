import * as XLSX from "xlsx";

// Estrutura real confirmada via teste ao vivo (card "Pancremo", account_id 41):
// item.item_details.custom_attributes é uma LISTA de objetos { name, type, value },
// não um objeto simples como era o custom_attributes da conversa.
// Ex.: [{ name: "Distribuidora", type: "string", value: "TESTE" }, ...]
//
// Os campos hoje passaram a viver no CARD do Kanban (não mais na conversa),
// o que permite existirem mesmo sem conversa vinculada (conversation: null).

// Transforma a lista de custom_attributes em um objeto simples { nome: valor },
// pra facilitar a leitura no resto do código.
function customAttributesToMap(item) {
  const list = item.item_details?.custom_attributes;
  if (!Array.isArray(list)) return {};
  const map = {};
  for (const attr of list) {
    if (!attr?.name) continue;
    const v = attr.value;
    map[attr.name] = Array.isArray(v) ? (v.length ? v.join(", ") : "") : v ?? "";
  }
  return map;
}

// Filtra itens por período (baseado em created_at do card).
export function filterByPeriod(items, { startDate, endDate }) {
  if (!startDate && !endDate) return items;
  const start = startDate ? new Date(startDate).getTime() : -Infinity;
  const end = endDate ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;
  return items.filter((item) => {
    const raw = item.created_at;
    if (!raw) return true;
    const ts = typeof raw === "number" ? raw * 1000 : new Date(raw).getTime();
    return ts >= start && ts <= end;
  });
}

// Gera e baixa o arquivo .xlsx a partir dos itens do Kanban.
export function exportToExcel(items, columns, filename = "export.xlsx") {
  const rows = items.map((item) => {
    const attrs = customAttributesToMap(item);
    const row = {};
    columns.forEach((col) => {
      row[col.label] = col.getValue(item, attrs);
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Exportação");

  ws["!cols"] = columns.map((col) => ({ wch: Math.max(col.label.length + 2, 14) }));

  XLSX.writeFile(wb, filename);
}

// Colunas fixas da v1 - Render Economia.
// Nomes batem exatamente com os "Campos Personalizados do Kanban" criados
// pelo Wagner no funil GD2 (confirmado ao vivo em 31/08/2026).
export const RENDER_EXPORT_COLUMNS = [
  { label: "Título", getValue: (i) => i.item_details?.title || "" },
  { label: "Etapa", getValue: (i) => i.funnel?.stages?.[i.funnel_stage]?.name || i.funnel_stage || "" },
  { label: "Valor", getValue: (i) => i.item_details?.value ?? "" },
  { label: "Criado em", getValue: (i) => formatDate(i.created_at) },
  { label: "Canal de Aquisição", getValue: (i, a) => a["Canal de Aquisição"] || "" },
  { label: "Nome do Parceiro", getValue: (i, a) => a["Nome do Parceiro"] || "" },
  { label: "Geradora", getValue: (i, a) => a["Geradora"] || "" },
  { label: "Distribuidora", getValue: (i, a) => a["Distribuidora"] || "" },
  { label: "Valor da Fatura", getValue: (i, a) => a["Valor da Fatura"] ?? "" },
  { label: "Comissão Total", getValue: (i, a) => a["Comissão Total"] ?? "" },
  { label: "Comissão Vendedor", getValue: (i, a) => a["Comissão Vendedor"] ?? "" },
  { label: "Comissão Parceiro", getValue: (i, a) => a["Comissão Parceiro"] ?? "" },
  { label: "Modelo de Pagamento", getValue: (i, a) => a["Modelo de Pagamento"] || "" },
];

function formatDate(raw) {
  if (!raw) return "";
  const ts = typeof raw === "number" ? raw * 1000 : new Date(raw).getTime();
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}
