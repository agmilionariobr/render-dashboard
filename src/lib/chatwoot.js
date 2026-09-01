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

// troca a empresa/conta ativa (multi-conta na mesma instância)
export function setActiveAccount(accountId) {
  const a = getAuth();
  if (!a) return;
  setAuth({ ...a, accountId });
}

// lista de contas/empresas que o usuário tem acesso
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

// atualiza tokens rotativos que o Devise devolve a cada request
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

// Lista os itens (cards) de um funil, paginado.
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

// Busca TODOS os itens de um funil, paginando automaticamente até acabar.
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

// Lista conversas de um inbox específico, uma página por vez.
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

// Busca todas as conversas de um inbox, paginando até acabar.
export async function listAllConversations({ inboxId, onProgress } = {}) {
  let page = 1;
  let all = [];
  while (true) {
    const { conversations, meta } = await listConversations({ inboxId, page });
    if (!conversations.length) break;
    all = all.concat(conversations);
    if (onProgress) onProgress(all.length, meta?.all_count);
    if (meta?.all_count && all.length >= meta.all_count) break;
    if (conversations.length < 25) break;
    page += 1;
    if (page > 200) break;
  }
  return all;
}

// Lista as definições de atributos customizados da conta
// (nome exibido, chave técnica, tipo, se é de conversa ou contato).
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
