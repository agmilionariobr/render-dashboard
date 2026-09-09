// Cliente da API do MilionCRM (Chatwoot).
// Chamadas via /api (proxy da Vercel).
// Autenticação com access-token, client e uid.

const BASE = "/api";
const STORAGE_KEY = "crm_dashboard_auth";

// ---------- gestão de credenciais ----------

export function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function setAuth(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

export function setActiveAccount(accountId) {
  const a = getAuth();
  if (!a) return;
  setAuth({ ...a, accountId });
}

export function getAccounts() {
  const a = getAuth();
  return a?.accounts || [];
}

function authHeaders() {
  const a = getAuth();
  if (!a) return {};

  return {
    "access-token": a.accessToken,
    client: a.client,
    uid: a.uid,
    "token-type": "Bearer",
  };
}

function refreshTokensFromResponse(res) {
  const newToken = res.headers.get("access-token");

  if (newToken) {
    const a = getAuth();

    if (a) {
      setAuth({
        ...a,
        accessToken: newToken,
        client: res.headers.get("client") || a.client,
        uid: res.headers.get("uid") || a.uid,
      });
    }
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  refreshTokensFromResponse(res);

  if (res.status === 401) {
    clearAuth();

    const error = new Error(
      "Sua sessão expirou. Saia e entre novamente."
    );
    error.status = 401;
    throw error;
  }

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (res.ok) {
      throw new Error(
        "A API retornou uma resposta inválida, fora do formato JSON."
      );
    }
  }

  if (!res.ok) {
    const error = new Error(data?.message || `Erro ${res.status}`);
    error.status = res.status;

    const retryAfter = res.headers.get("retry-after");

    if (retryAfter) {
      const seconds = Number(retryAfter);
      const waitMs = Number.isFinite(seconds)
        ? seconds * 1000
        : Date.parse(retryAfter) - Date.now();

      if (Number.isFinite(waitMs)) {
        error.retryAfterMs = Math.max(0, waitMs);
      }
    }

    throw error;
  }

  return data;
}

// ---------- autenticação ----------

export async function login(email, password) {
  const res = await fetch(`${BASE}/auth/sign_in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "omit",
  });

  if (!res.ok) {
    const t = await res.text();
    let msg;

    if (res.status === 401) {
      msg = "Login ou senha inválidos";
    } else if (res.status === 409) {
      msg =
        "Já existe uma sessão ativa. Saia do MilionCRM em outros dispositivos ou limpe os dados do site e tente de novo.";
    } else {
      msg = `Erro ao entrar (${res.status})`;
    }

    try {
      const j = JSON.parse(t);
      msg = j.errors?.[0] || j.message || msg;
    } catch {}

    throw new Error(msg);
  }

  const body = await res.json();
  const user = body.data;
  const accounts = user.accounts || [];
  const autoAccountId = accounts.length === 1 ? accounts[0].id : null;

  const auth = {
    accessToken: res.headers.get("access-token"),
    client: res.headers.get("client"),
    uid: res.headers.get("uid"),
    accountId: autoAccountId,
    userId: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url,
    accounts,
  };

  if (!auth.accessToken) {
    throw new Error("Servidor não retornou token de acesso");
  }

  setAuth(auth);
  return auth;
}

export function logout() {
  clearAuth();
  clearSiteCookies();
}

function clearSiteCookies() {
  try {
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (!name) return;

      document.cookie =
        `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie =
        `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/api`;
    });
  } catch {}
}

// ---------- Kanban / funis ----------

export async function listFunnels() {
  const { accountId } = getAuth();
  const data = await request(
    `/api/v1/accounts/${accountId}/funnels`
  );

  return Array.isArray(data) ? data : data?.payload || [];
}

export async function listKanbanItems({
  funnelId,
  stageId,
  page = 1,
} = {}) {
  const { accountId } = getAuth();
  const qs = new URLSearchParams();

  if (funnelId) qs.set("funnel_id", funnelId);
  if (stageId) qs.set("stage_id", stageId);
  qs.set("page", page);

  const data = await request(
    `/api/v1/accounts/${accountId}/kanban_items?${qs.toString()}`
  );

  return {
    items: data?.items || data?.payload || [],
    pagination: data?.pagination || {},
  };
}

export async function listAllKanbanItems({
  funnelId,
  stageId,
  onProgress,
} = {}) {
  let page = 1;
  let all = [];

  while (true) {
    const { items, pagination } = await listKanbanItems({
      funnelId,
      stageId,
      page,
    });

    all = all.concat(items);

    if (onProgress) {
      onProgress(all.length, pagination?.total_count);
    }

    const totalPages = pagination?.total_pages || 1;
    if (page >= totalPages || items.length === 0) break;
    page += 1;
  }

  return all;
}

// ---------- conversas / atributos customizados ----------

export async function getConversation(conversationId) {
  const { accountId } = getAuth();

  return request(
    `/api/v1/accounts/${accountId}/conversations/${conversationId}`
  );
}

export async function listConversations({
  inboxId,
  page = 1,
} = {}) {
  const accountId = getAuth()?.accountId;

  if (!accountId) {
    throw new Error("Entre novamente e selecione a empresa.");
  }

  const qs = new URLSearchParams();

  if (inboxId) qs.set("inbox_id", inboxId);
  qs.set("status", "all");
  qs.set("page", page);

  const data = await request(
    `/api/v1/accounts/${accountId}/conversations?${qs.toString()}`
  );

  const conversations = data?.data?.payload ?? data?.payload;

  if (!Array.isArray(conversations)) {
    throw new Error(
      "A API não retornou uma lista válida de conversas."
    );
  }

  return {
    conversations,
    meta: data?.data?.meta || data?.meta || {},
  };
}

// Repete apenas consultas de leitura com falhas temporárias.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;
const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function readConversationPage({ inboxId, page, session }) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const current = getAuth();

      if (
        !current ||
        current.accountId !== session.accountId ||
        current.uid !== session.uid
      ) {
        throw new Error(
          "A sessão ou empresa mudou. Abra o relatório novamente."
        );
      }

      return await listConversations({ inboxId, page });
    } catch (error) {
      const temporary =
        RETRYABLE_STATUS.has(error.status) ||
        (error instanceof TypeError && !error.status);

      if (!temporary || attempt === MAX_ATTEMPTS) {
        const status = error.status
          ? ` HTTP ${error.status}.`
          : "";

        throw new Error(
          `Falha na caixa ${inboxId}, página ${page}, após ${attempt} tentativa(s).` +
          `${status} ${error.message} O relatório não foi concluído.`
        );
      }

      // Pausas de 1, 2 e 4 segundos entre as tentativas.
      // Respeita uma pausa maior quando solicitada pela API.
      const delay = Math.max(
        1000 * 2 ** (attempt - 1),
        error.retryAfterMs || 0
      );

      await wait(delay);
    }
  }
}

// No máximo duas páginas simultâneas.
// Durante as tentativas automáticas, repete apenas a página
// que falhou e mantém as páginas concluídas nesta execução.
export async function listAllConversations({
  inboxId,
  onProgress,
  concurrency = 2,
} = {}) {
  const session = getAuth();

  if (!session?.accountId) {
    throw new Error("Entre novamente e selecione a empresa.");
  }

  const batchSize = Math.max(
    1,
    Math.min(2, Math.floor(Number(concurrency)) || 2)
  );

  const readPage = (page) =>
    readConversationPage({ inboxId, page, session });

  const first = await readPage(1);
  let all = [...first.conversations];

  const pageSize = first.conversations.length || 25;
  const rawTotal = first.meta?.all_count;
  const totalCount = Number(rawTotal);

  if (
    rawTotal == null ||
    !Number.isInteger(totalCount) ||
    totalCount < 0
  ) {
    throw new Error(
      "A API não informou um total válido de conversas. Atualize novamente."
    );
  }

  if (onProgress) onProgress(all.length, totalCount);

  if (first.conversations.length === 0) {
    if (totalCount === 0) return [];

    throw new Error(
      `A caixa ${inboxId} informou ${totalCount} conversas, mas a página 1 veio vazia.`
    );
  }

  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return all;

  const remainingPages = [];

  for (let p = 2; p <= totalPages; p++) {
    remainingPages.push(p);
  }

  for (let i = 0; i < remainingPages.length; i += batchSize) {
    const batch = remainingPages.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(readPage));

    const failed = results.find(
      (result) => result.status === "rejected"
    );

    if (failed) throw failed.reason;

    for (let index = 0; index < results.length; index++) {
      const conversations = results[index].value.conversations;

      if (conversations.length === 0) {
        throw new Error(
          `A caixa ${inboxId}, página ${batch[index]}, veio vazia antes do fim esperado. ` +
          "Atualize novamente para conferir o total."
        );
      }

      all = all.concat(conversations);
    }

    if (onProgress) onProgress(all.length, totalCount);
  }

  return all;
}

export async function listCustomAttributeDefinitions() {
  const { accountId } = getAuth();

  const data = await request(
    `/api/v1/accounts/${accountId}/custom_attribute_definitions`
  );

  return Array.isArray(data) ? data : data?.payload || [];
}

// ---------- perfil ----------

export async function getProfile() {
  return request(`/api/v1/profile`);
}
