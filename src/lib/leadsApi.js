import { getAuth, setAuth, clearAuth } from "./chatwoot.js";

function normalizeReport(data) {
  if (!Array.isArray(data)) {
    throw new Error("O relatório retornou um formato inesperado.");
  }

  const seen = new Set();

  return data.map((item) => {
    const timestamp = Number(item?.timestamp);
    const count = Number(item?.value);

    if (
      item?.timestamp == null ||
      item?.value == null ||
      !Number.isSafeInteger(timestamp) ||
      timestamp < 0 ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      seen.has(timestamp) ||
      !Number.isFinite(new Date(timestamp * 1000).getTime())
    ) {
      throw new Error(
        "O relatório retornou datas ou contagens inválidas."
      );
    }

    seen.add(timestamp);
    return { timestamp, count };
  });
}

// Consulta contagens agregadas, sem baixar os detalhes das conversas.
// Mantém UTC, a mesma regra de datas usada no relatório anterior.
export async function getDailyLeadCounts({
  accountId,
  inboxId,
  signal,
  onProgress,
}) {
  const session = getAuth();

  if (
    !session?.accessToken ||
    Number(session.accountId) !== Number(accountId)
  ) {
    throw new Error("Entre novamente e selecione a empresa.");
  }

  const until = Math.floor(Date.now() / 1000);

  async function query(groupBy, since) {
    const auth = getAuth();

    if (
      !auth?.accessToken ||
      auth.uid !== session.uid ||
      Number(auth.accountId) !== Number(accountId)
    ) {
      throw new Error(
        "A sessão ou empresa mudou. Abra o relatório novamente."
      );
    }

    const params = new URLSearchParams({
      metric: "conversations_count",
      type: "inbox",
      id: String(inboxId),
      since: String(since),
      until: String(until),
      group_by: groupBy,
      timezone_offset: "0",
    });

    const response = await fetch(
      `/api/api/v2/accounts/${accountId}/reports?${params}`,
      {
        signal,
        headers: {
          "Content-Type": "application/json",
          "access-token": auth.accessToken,
          client: auth.client,
          uid: auth.uid,
          "token-type": "Bearer",
        },
      }
    );

    const current = getAuth();
    const sameSession =
      current?.accessToken === auth.accessToken &&
      current?.uid === auth.uid;

    if (response.status === 401) {
      if (sameSession) clearAuth();

      throw new Error(
        "Sua sessão expirou. Saia e entre novamente."
      );
    }

    const token = response.headers.get("access-token");

    if (token && sameSession) {
      setAuth({
        ...current,
        accessToken: token,
        client: response.headers.get("client") || current.client,
        uid: response.headers.get("uid") || current.uid,
      });
    }

    if (!response.ok) {
      throw new Error(
        `Erro HTTP ${response.status} ao consultar o relatório da caixa ${inboxId}.`
      );
    }

    const rows = normalizeReport(await response.json());

    if (
      rows.some(
        (row) => row.timestamp < since || row.timestamp > until
      )
    ) {
      throw new Error(
        "O relatório retornou datas fora do período solicitado."
      );
    }

    return rows;
  }

  // Localiza o início do histórico e calcula o total pelos meses.
  onProgress?.("Conferindo o histórico...");

  const months = await query("month", 0);
  const activeMonths = months.filter((row) => row.count > 0);

  if (activeMonths.length === 0) return [];

  const since = Math.min(
    ...activeMonths.map((row) => row.timestamp)
  );

  const expectedTotal = months.reduce(
    (sum, row) => sum + row.count,
    0
  );

  // Busca a contagem diária desde o primeiro mês com conversas.
  onProgress?.("Carregando as contagens por dia...");

  const days = await query("day", since);

  const dailyTotal = days.reduce(
    (sum, row) => sum + row.count,
    0
  );

  if (dailyTotal !== expectedTotal) {
    throw new Error(
      "As contagens mensal e diária não coincidiram. Clique em Atualizar para conferir novamente."
    );
  }

  return days
    .filter((row) => row.count > 0)
    .map((row) => ({
      date: new Date(row.timestamp * 1000)
        .toISOString()
        .slice(0, 10),
      count: row.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
