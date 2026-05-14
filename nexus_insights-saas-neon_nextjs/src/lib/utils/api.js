/**
 * API client — cross-browser compatible auth architecture
 *
 * WHY THIS DESIGN:
 * Frontend is on Vercel (carbonless-pi.vercel.app) and backend on Render
 * (different domains). Safari ITP, iOS, and Edge block third-party cookies
 * even with SameSite=None; Secure — so backend-set HttpOnly cookies never
 * arrive on cross-origin requests on these browsers.
 *
 * SOLUTION — two-layer token storage:
 *  • access_token  → memory (module-level variable) + localStorage fallback
 *    - sent as Authorization: Bearer header on every API call
 *    - works cross-origin on ALL browsers (headers are never ITP-blocked)
 *  • refresh_token → httpOnly first-party cookie set by /api/auth/login
 *    - set by Next.js server route (same-origin) → never blocked by ITP
 *    - unreadable by JavaScript (XSS-safe)
 *    - rotated automatically on every refresh
 *
 * AUTH FLOW:
 *  login   → POST /api/auth/login (Next.js, same-origin)
 *         → gets access token in body, refresh in httpOnly cookie
 *  request → Authorization: Bearer <access_token>
 *  401     → POST /api/auth/refresh (Next.js, reads httpOnly cookie)
 *         → gets new access token, retry
 *  logout  → POST /api/auth/logout (Next.js, clears cookie)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// ── In-memory token (fastest; survives page without localStorage overhead) ────
let _accessToken = null;

// ── Session cookie for middleware routing (first-party, client-readable) ──────
export function markSessionActive() {
  if (typeof document === 'undefined') return;
  document.cookie = 'carbonless_auth=1; path=/; SameSite=Lax; Max-Age=86400';
}
export function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'carbonless_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
}

// ── Access token helpers ──────────────────────────────────────────────────────
function getAccessToken() {
  if (_accessToken) return _accessToken;
  // localStorage fallback (survives page reload)
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('_ca_token');
    if (stored) { _accessToken = stored; return stored; }
  }
  return null;
}

function setAccessToken(token) {
  _accessToken = token;
  if (typeof window !== 'undefined' && token) {
    localStorage.setItem('_ca_token', token);
  }
}

function clearAccessToken() {
  _accessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('_ca_token');
  }
}

// ── Core authenticated fetch ──────────────────────────────────────────────────
async function request(endpoint, options = {}) {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status !== 401) return res;

  // ── Silent token refresh via Next.js same-origin route ───────────────────
  const refreshRes = await fetch('/api/auth/refresh', { method: 'POST' });

  if (!refreshRes.ok) {
    clearAccessToken();
    clearSessionCookie();
    if (typeof window !== 'undefined') window.location.href = '/login?reason=session_expired';
    return new Response(null, { status: 401 });
  }

  const { access } = await refreshRes.json();
  setAccessToken(access);

  // Retry original request with new token
  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { ...headers, Authorization: `Bearer ${access}` },
    credentials: 'include',
  });
}

// ── Public API ────────────────────────────────────────────────────────────────
export const api = {

  // Login via Next.js proxy — avoids ALL cross-site cookie issues
  login: async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
    });
    if (res.ok) {
      const { access } = await res.clone().json().catch(() => ({}));
      if (access) setAccessToken(access);
    }
    return res;
  },

  logout: async () => {
    const token = getAccessToken();
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {}
    clearAccessToken();
    clearSessionCookie();
    if (typeof window !== 'undefined') window.location.href = '/login';
  },

  getProfile: () => request('/accounts/profile/'),
  getNotifications: () => request('/accounts/notifications/'),
  markNotificationsRead: (ids) => request('/accounts/notifications/read/', {
    method: 'POST',
    body: JSON.stringify(ids ? { ids } : {}),
  }),
  getUnreadCount: () => request('/accounts/notifications/unread-count/'),

  // Company
  createCompany: (data) => request('/companies/create/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Facilities
  getFacilities: () => request('/companies/facilities/'),
  createFacility: (data) => request('/companies/facilities/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Memberships
  getMemberships: () => request('/companies/memberships/'),
  updateMembership: (id, data) => request(`/companies/memberships/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  // Emissions
  getFactors: (params = '') => request(`/emissions/factors/${params ? '?' + params : ''}`),
  getEntries: (params = '') => request(`/emissions/entries/${params ? '?' + params : ''}`),
  createEntry: (data) => request('/emissions/entries/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  createEntryWithFile: (formData) => {
    const token = getAccessToken();
    return fetch(`${API_BASE}/emissions/entries/`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  },
  updateEntry: (id, data) => request(`/emissions/entries/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  deleteEntry: (id) => request(`/emissions/entries/${id}/`, { method: 'DELETE' }),
  getSummary: (year = 2026) => request(`/emissions/summary/?year=${year}`),

  // Targets
  getTargets: () => request('/emissions/targets/'),
  createTarget: (data) => request('/emissions/targets/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateTarget: (id, data) => request(`/emissions/targets/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  deleteTarget: (id) => request(`/emissions/targets/${id}/`, { method: 'DELETE' }),

  // Custom Emission Requests
  getCustomRequests: () => request('/emissions/custom-requests/'),
  createCustomRequest: (data) => request('/emissions/custom-requests/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Reports & Exports
  getReportUrl: (year, lang) => `${API_BASE}/emissions/report/?year=${year}&lang=${lang}`,
  getCsvUrl: (year) => `${API_BASE}/emissions/export-csv/?year=${year}`,
  getExcelUrl: (year) => `${API_BASE}/emissions/export-excel/?year=${year}`,

  // Approval
  approveEntry: (id, action, reason) => request(`/emissions/entries/${id}/approve/`, {
    method: 'POST',
    body: JSON.stringify({ action, reason }),
  }),

  // Facility analytics
  getByFacility: (year) => request(`/emissions/by-facility/?year=${year}`),

  // Pending review
  getPendingEntries: () => request('/emissions/pending/'),

  // Invite
  inviteMember: (data) => request('/companies/invite/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  acceptInvite: (token) => request('/companies/accept-invite/', {
    method: 'POST',
    body: JSON.stringify({ token }),
  }),

  // Account
  changePassword: (data) => request('/accounts/change-password/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateProfile: (data) => request('/accounts/update-profile/', {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  deleteAccount: (password) => request('/accounts/delete-account/', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  }),
  exportAll: () => request('/emissions/export-all/'),

  // Questionnaire — Legacy
  startQuestionnaire: (lang) => request('/questionnaire/legacy/start/', {
    method: 'POST',
    body: JSON.stringify({ lang }),
  }),
  answerQuestion: (data) => request('/questionnaire/legacy/answer/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getQuestionnaireSessions: () => request('/questionnaire/legacy/sessions/'),
  resetQuestionnaire: () => request('/questionnaire/legacy/reset/', { method: 'POST' }),
  getQuestionnaireProfile: () => request('/questionnaire/legacy/profile/'),

  // CarbonIQ — Structured report wizard
  startCarbonReport: () => request('/questionnaire/start/', { method: 'POST' }),
  submitReportStep: (reportId, step, data) => request(`/questionnaire/${reportId}/step/`, {
    method: 'PATCH',
    body: JSON.stringify({ step, data }),
  }),
  getReportStatus: (reportId) => request(`/questionnaire/${reportId}/`),
  listReports: () => request('/questionnaire/'),

  // CarbonIQ — AI chat
  aiChat: (data) => request('/questionnaire/ai/chat/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};
