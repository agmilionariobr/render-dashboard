// Cliente da API do MilionCRM (Chatwoot).
// Todas as chamadas passam por /api (proxy do Vercel) -> milioncrm.agmilionario.com.br
// Autenticação via login/senha (DeviseTokenAuth): guarda access-token/client/uid.
// Base reaproveitada do projeto "milionchat".

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
    throw new Error("unauthorized");
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.message || `Erro ${res.status}`);
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
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/api`;
    });
  } catch {}
}

// ---------- Kanban / funis ----------
export async function listFunnels() {
  const { accountId } = getAuth();
  const data = await request(`/api/v1/accounts/${accountId}/funnels`);
  return Array.isArray(data) ? data : data?.payload || [];
}

export async function listKanbanItems({ funnelId, stageId, page = 1 } = {}) {
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

export async function listAllKanbanItems({ funnelId, stageId, onProgress } = {}) {
  let page = 1;
  let all = [];
  while (true) {
    const { items, pagination } = await listKanbanItems({ funnelId, stageId, page });
    all = all.concat(items);
    if (onProgress) onProgress(all.length, pagination?.total_count);
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

export async function listConversations({ inboxId, page = 1 } = {}) {
  const { accountId } = getAuth();
  const qs = new URLSearchParams();
  if (inboxId) qs.set("inbox_id", inboxId);
  qs.set("status", "all");
  qs.set("page", page);
  const data = await request(
    `/api/v1/accounts/${accountId}/conversations?${qs.toString()}`
  );
  return {
    conversations: data?.data?.payload || data?.payload || [],
    meta: data?.data?.meta || data?.meta || {},
  };
}

// Busca todas as conversas de um inbox, paginando em paralelo (lotes de
// algumas páginas por vez) para acelerar quando o volume é grande (ex: 1500+).
export async function listAllConversations({ inboxId, onProgress, concurrency = 5 } = {}) {
  const first = await listConversations({ inboxId, page: 1 });
  let all = [...first.conversations];
  const pageSize = first.conversations.length || 25;
  const totalCount = first.meta?.all_count;

  if (onProgress) onProgress(all.length, totalCount);

  if (!totalCount || first.conversations.length < pageSize) {
    return all;
  }

  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return all;

  const remainingPages = [];
  for (let p = 2; p <= totalPages; p++) remainingPages.push(p);

  for (let i = 0; i < remainingPages.length; i += concurrency) {
    const batch = remainingPages.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((p) => listConversations({ inboxId, page: p }))
    );
    for (const r of results) {
      all = all.concat(r.conversations);
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
