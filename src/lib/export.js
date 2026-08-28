import * as XLSX from "xlsx";
import { getConversation } from "./chatwoot";

// Extrai o conversation_id de um item do Kanban.
// O formato pode variar (item_details.conversation_id, conversation_id direto, etc.)
// então tentamos os caminhos mais comuns.
function extractConversationId(item) {
  return (
    item.conversation_id ||
    item.item_details?.conversation_id ||
    item.conversation?.id ||
    null
  );
}

// Para cada card do Kanban, busca a conversa vinculada e extrai os
// custom_attributes. Roda em lotes pequenos para não sobrecarregar a API.
export async function enrichItemsWithCustomAttributes(items, { onProgress, batchSize = 5 } = {}) {
  const enriched = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (item) => {
        const conversationId = extractConversationId(item);
        if (!conversationId) return { ...item, custom_attributes: {} };
        try {
          const conv = await getConversation(conversationId);
          return { ...item, custom_attributes: conv?.custom_attributes || {} };
        } catch {
          return { ...item, custom_attributes: {} };
        }
      })
    );
    enriched.push(...results);
    if (onProgress) onProgress(enriched.length, items.length);
  }
  return enriched;
}

// Filtra itens por período (baseado em created_at, em segundos unix ou ISO).
export function filterByPeriod(items, { startDate, endDate }) {
  if (!startDate && !endDate) return items;
  const start = startDate ? new Date(startDate).getTime() : -Infinity;
  const end = endDate ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity; // fim do dia
  return items.filter((item) => {
    const raw = item.created_at || item.item_details?.created_at;
    if (!raw) return true;
    const ts = typeof raw === "number" ? raw * 1000 : new Date(raw).getTime();
    return ts >= start && ts <= end;
  });
}

// Gera e baixa o arquivo .xlsx a partir dos itens enriquecidos.
// `columns` define quais colunas fixas aparecem e em que ordem.
export function exportToExcel(items, columns, filename = "export.xlsx") {
  const rows = items.map((item) => {
    const row = {};
    columns.forEach((col) => {
      row[col.label] = col.getValue(item);
    });
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Exportação");

  // largura automática simples por coluna
  ws["!cols"] = columns.map((col) => ({ wch: Math.max(col.label.length + 2, 14) }));

  XLSX.writeFile(wb, filename);
}

// Colunas fixas da v1 - Render Economia.
// title/value do card + os 9 atributos customizados mapeados.
export const RENDER_EXPORT_COLUMNS = [
  { label: "Título", getValue: (i) => i.item_details?.title || i.title || "" },
  { label: "Status", getValue: (i) => i.item_details?.status || i.status || "" },
  { label: "Valor", getValue: (i) => i.item_details?.value ?? "" },
  { label: "Criado em", getValue: (i) => formatDate(i.created_at) },
  { label: "Distribuidora", getValue: (i) => i.custom_attributes?.distribuidora || "" },
  { label: "Usina", getValue: (i) => i.custom_attributes?.usina || "" },
  { label: "Valor Conta", getValue: (i) => i.custom_attributes?.valor_conta ?? "" },
  { label: "Comissão Render", getValue: (i) => i.custom_attributes?.comisso_render ?? "" },
  { label: "Comissão Vendedor", getValue: (i) => i.custom_attributes?.comisso_vendedor ?? "" },
  { label: "Comissão Parceiro", getValue: (i) => i.custom_attributes?.comisso_parceiro ?? "" },
  { label: "Canal de Aquisição", getValue: (i) => i.custom_attributes?.canal_de_aquisio || "" },
  { label: "Parceiro", getValue: (i) => i.custom_attributes?.parceiro || "" },
  { label: "Modelo de Pagamento", getValue: (i) => i.custom_attributes?.modelo_de_pagamento || "" },
];

function formatDate(raw) {
  if (!raw) return "";
  const ts = typeof raw === "number" ? raw * 1000 : new Date(raw).getTime();
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}
