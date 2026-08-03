// @ts-check
// Incremental TypeScript adoption: JSDoc types enable full IDE intellisense and
// tsc --checkJs validation without requiring a full .ts rewrite.

/** @type {string} */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Session cookie for Next.js middleware routing (first-party, not auth)
/** @returns {void} */
export function markSessionActive() {
  if (typeof document === 'undefined') return;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `carbonless_auth=1; path=/; SameSite=Lax; Max-Age=86400${secure}`;
}
export function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'carbonless_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
}

// Access token (memory + localStorage)
/** @type {string | null} */
let _token = null;
/** @type {Promise<{ok: boolean, access: string | null}> | null} */
let _refreshPromise = null;

/** @returns {string | null} */
function getToken() {
  if (_token) return _token;
  if (typeof window !== 'undefined') {
    _token = localStorage.getItem('_ca') || null;
  }
  return _token;
}

/** @param {string | null} t */
function setToken(t) {
  _token = t;
  if (typeof window !== 'undefined') {
    if (t) localStorage.setItem('_ca', t);
    else localStorage.removeItem('_ca');
  }
}

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * fetch() with a hard 30 s abort timeout.
 * @param {string} url
 * @param {RequestInit} [opts]
 * @returns {Promise<Response>}
 */
function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Authenticated fetch — auto-attaches Bearer token + retries on 401 via doRefresh().
 * @param {string} endpoint  API path relative to API_BASE (e.g. '/accounts/profile/')
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status !== 401) return res;

  const refreshResult = await doRefresh();
  if (!refreshResult?.ok) return new Response(null, { status: 401 });

  const { access } = refreshResult;
  // Token already written inside doRefresh; setToken here keeps the path symmetric.
  setToken(access);

  return fetchWithTimeout(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { ...headers, Authorization: `Bearer ${access}` },
    credentials: 'include',
  });
}

// Singleton refresh: one network call for any number of concurrent 401s.
// The promise resolves with { ok, access }; body is consumed once and shared.
// _refreshPromise is cleared INSIDE .then() — after the token is written —
// so concurrent callers that arrive in the tiny gap wait for the token,
// not start a second refresh.
async function doRefresh() {
  if (!_refreshPromise) {
    _refreshPromise = fetchWithTimeout('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(async rr => {
        if (!rr.ok) {
          _refreshPromise = null;
          return { ok: false, access: null };
        }
        try {
          const data = await rr.json();
          const access = data.access || null;
          if (access) setToken(access);
          _refreshPromise = null;
          return { ok: !!access, access };
        } catch {
          _refreshPromise = null;
          return { ok: false, access: null };
        }
      })
      .catch(() => { _refreshPromise = null; return { ok: false, access: null }; });
  }
  const result = await _refreshPromise;
  if (!result?.ok) {
    setToken(null);
    clearSessionCookie();
    if (typeof window !== 'undefined') window.location.href = '/login?reason=session_expired';
  }
  return result;
}

export const api = {
  login: async (credential, password) => {
    const c = typeof credential === 'string' ? credential.trim() : credential;
    // Use fetchWithTimeout (30 s) so a hung login proxy does not permanently
    // freeze the submit button in the loading state.
    const res = await fetchWithTimeout('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Send both fields so the backend can match by username OR email
      // depending on which Django auth backend is configured.
      body: JSON.stringify({ username: c, email: c, password }),
    });
    if (res.ok) {
      const d = await res.clone().json().catch(() => ({}));
      if (d.access) setToken(d.access);
    }
    return res;
  },

  googleLogin: async (credential) => {
    const res = await fetchWithTimeout('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    if (res.ok) {
      const d = await res.clone().json().catch(() => ({}));
      if (d.access) setToken(d.access);
    }
    return res;
  },

  logout: async () => {
    const token = getToken();
    try {
      // fetchWithTimeout ensures a hung logout endpoint cannot prevent
      // setToken(null) / clearSessionCookie() / the redirect from running.
      // Fix #60: credentials:'include' sends the HttpOnly refresh_token cookie so
      // the backend blacklists it (Fix #55).  Without it the blacklist never fires.
      await fetchWithTimeout('/api/auth/logout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
    } catch {}
    setToken(null);
    clearSessionCookie();
    if (typeof window !== 'undefined') window.location.href = '/login';
  },

  getProfile: () => request('/accounts/profile/'),
  getNotifications: () => request('/accounts/notifications/'),
  markNotificationsRead: (ids) => request('/accounts/notifications/read/', { method: 'POST', body: JSON.stringify(ids ? { ids } : {}) }),
  getUnreadCount: () => request('/accounts/notifications/unread-count/'),

  getCompanyDetail: () => request('/companies/detail/'),
  updateCompany: (data) => request('/companies/detail/', { method: 'PATCH', body: JSON.stringify(data) }),
  createCompany: (data) => request('/companies/create/', { method: 'POST', body: JSON.stringify(data) }),

  getFacilities: () => request('/companies/facilities/'),
  createFacility: (data) => request('/companies/facilities/', { method: 'POST', body: JSON.stringify(data) }),

  getMemberships: () => request('/companies/memberships/'),
  updateMembership: (id, data) => request(`/companies/memberships/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),

  getScope3Categories: () => request('/emissions/scope3-categories/'),
  getFactors: (params = '') => request(`/emissions/factors/${params ? '?' + params : ''}`),
  getEntries: (params = '') => request(`/emissions/entries/${params ? '?' + params : ''}`),
  createEntry: (data) => request('/emissions/entries/', { method: 'POST', body: JSON.stringify(data) }),
  createEntryWithFile: async (formData) => {
    // FormData uploads cannot use request() (which sets Content-Type: application/json),
    // so we handle the 401 token-refresh path manually here.
    // Fix 24C: use fetchWithTimeout() on both paths so hung uploads don't stall forever.
    const token = getToken();
    const res = await fetchWithTimeout(`${API_BASE}/emissions/entries/`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (res.status !== 401) return res;
    const refreshResult = await doRefresh();
    if (!refreshResult?.ok) return new Response(null, { status: 401 });
    return fetchWithTimeout(`${API_BASE}/emissions/entries/`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${refreshResult.access}` },
      body: formData,
    });
  },
  updateEntry: (id, data) => request(`/emissions/entries/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEntry: (id) => request(`/emissions/entries/${id}/`, { method: 'DELETE' }),
  getSummary: (year = new Date().getFullYear()) => request(`/emissions/summary/?year=${year}`),

  getTargets: () => request('/emissions/targets/'),
  createTarget: (data) => request('/emissions/targets/', { method: 'POST', body: JSON.stringify(data) }),
  updateTarget: (id, data) => request(`/emissions/targets/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTarget: (id) => request(`/emissions/targets/${id}/`, { method: 'DELETE' }),

  getCustomRequests: () => request('/emissions/custom-requests/'),
  createCustomRequest: (data) => request('/emissions/custom-requests/', { method: 'POST', body: JSON.stringify(data) }),

  downloadReport: (year, lang) => request(`/emissions/report/?year=${year}&lang=${lang}`),
  downloadCsv: (year) => request(`/emissions/export-csv/?year=${year}`),
  downloadExcel: (year) => request(`/emissions/export-excel/?year=${year}`),

  approveEntry: (id, action, reason) => request(`/emissions/entries/${id}/approve/`, { method: 'POST', body: JSON.stringify({ action, reason }) }),
  getByFacility: (year) => request(`/emissions/by-facility/?year=${year}`),
  getPendingEntries: () => request('/emissions/pending/'),

  inviteMember: (data) => request('/companies/invite/', { method: 'POST', body: JSON.stringify(data) }),
  acceptInvite: (token) => request('/companies/accept-invite/', { method: 'POST', body: JSON.stringify({ token }) }),

  changePassword: (data) => request('/accounts/change-password/', { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (data) => request('/accounts/update-profile/', { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (password) => request('/accounts/delete-account/', { method: 'DELETE', body: JSON.stringify({ password }) }),
  exportAll: () => request('/emissions/export-all/'),

  startCarbonReport: (title = '', forceNew = false) => request('/questionnaire/start/', {
    method: 'POST',
    body: JSON.stringify({ title, force_new: forceNew })
  }),
  resetQuestionnaire: () => request('/questionnaire/reset/', { method: 'POST' }),
  submitReportStep: (reportId, step, data) => request(`/questionnaire/${reportId}/step/`, {
    method: 'PATCH',
    body: JSON.stringify({ step, data }),
  }),
  saveReportDraft: (reportId, data) => request(`/questionnaire/${reportId}/draft/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  getReportStatus: (reportId) => request(`/questionnaire/${reportId}/`),
  deleteReport: (reportId) => request(`/questionnaire/${reportId}/`, { method: 'DELETE' }),
  downloadQuestionnairePdf: (reportId, lang = 'en') => request(`/questionnaire/${reportId}/pdf/?lang=${lang}`),
  listReports: () => request('/questionnaire/'),

  // Chat sessions
  getChatSessions: () => request('/chat/sessions/'),
  createChatSession: (title = 'New Chat') => request('/chat/sessions/new/', { method: 'POST', body: JSON.stringify({ title }) }),
  getChatSession: (id) => request(`/chat/sessions/${id}/`),
  deleteChatSession: (id) => request(`/chat/sessions/${id}/`, { method: 'DELETE' }),
  sendChatMessage: (sessionId, content, language) => request(`/chat/sessions/${sessionId}/message/`, { method: 'POST', body: JSON.stringify({ content, language }) }),
  sendChatMessageWithFile: (sessionId, formData) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('_ca') : null;
    /** @type {Record<string, string>} */
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/chat/sessions/${sessionId}/message/`, {
      method: 'POST',
      headers: /** @type {HeadersInit} */ (headers),
      body: formData,
      credentials: 'include',
    });
  },
  confirmEmissionEntry: (entryData) => request('/chat/confirm-entry/', { method: 'POST', body: JSON.stringify(entryData) }),
};

/**
 * Low-level authenticated fetch — exported so workspace/ai helpers can call
 * arbitrary endpoints without duplicating the auth + refresh logic.
 * Usage: import { request } from '@/lib/utils/api'
 */
export { request };
