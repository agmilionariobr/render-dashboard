import * as XLSX from "xlsx";

// Agrupa conversas por dia de criação (created_at vem em segundos unix).
// Retorna um array ordenado por data: [{ date: "2026-08-01", count: 12 }, ...]
export function groupByDay(conversations) {
  const counts = {};
  for (const conv of conversations) {
    const raw = conv.created_at;
    if (!raw) continue;
    const ts = typeof raw === "number" ? raw * 1000 : new Date(raw).getTime();
    const d = new Date(ts);
    if (isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Filtra o array já agrupado por um período de datas (opcional).
export function filterRowsByPeriod(rows, { startDate, endDate }) {
  if (!startDate && !endDate) return rows;
  return rows.filter((r) => {
    if (startDate && r.date < startDate) return false;
    if (endDate && r.date > endDate) return false;
    return true;
  });
}

function formatDateBR(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

// Gera e baixa o Excel com data (formatada BR) e quantidade de leads por dia,
// incluindo uma linha de total no final.
export function exportLeadsReport(rows, filename = "leads_por_dia.xlsx") {
  const data = rows.map((r) => ({
    Data: formatDateBR(r.date),
    "Quantidade de Leads": r.count,
  }));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  data.push({ Data: "TOTAL", "Quantidade de Leads": total });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads por dia");
  ws["!cols"] = [{ wch: 14 }, { wch: 20 }];

  XLSX.writeFile(wb, filename);
}
