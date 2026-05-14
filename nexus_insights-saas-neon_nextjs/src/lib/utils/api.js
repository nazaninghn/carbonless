const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// ── Session indicator cookie (client-readable, used by middleware for routing) ──
// NOT the auth token — actual auth uses localStorage JWT + Authorization header.
// This first-party cookie is safe on all browsers (same-site, not HttpOnly).
export function markSessionActive() {
  if (typeof document === 'undefined') return;
  document.cookie = 'carbonless_auth=1; path=/; SameSite=Lax; Max-Age=86400';
}
export function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'carbonless_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
}

// ── Token storage (localStorage) ─────────────────────────────────────────────
// localStorage is NOT subject to cross-site / ITP cookie restrictions.
// Works on Safari, iOS, Edge, Chrome — everywhere.
// Backend CookieJWTAuthentication checks Authorization header FIRST, then cookie.
function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}
function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refresh_token');
}
export function saveTokens(access, refresh) {
  if (typeof window === 'undefined') return;
  if (access) localStorage.setItem('access_token', access);
  if (refresh) localStorage.setItem('refresh_token', refresh);
}
export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

// ── Authenticated fetch ───────────────────────────────────────────────────────
async function request(endpoint, options = {}) {
  const access = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    // Bearer token — works cross-origin on all browsers (no cookie ITP issue)
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // keep for cookie fallback on same-site setups
  });

  if (res.status === 401) {
    // Try silent token refresh using stored refresh token
    const refresh = getRefreshToken();
    if (!refresh) {
      clearSessionCookie();
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/login?reason=session_expired';
      return new Response(null, { status: 401 });
    }

    const refreshRes = await fetch(`${API_BASE}/accounts/token/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }), // send in body — works cross-origin
    });

    if (refreshRes.ok) {
      const refreshData = await refreshRes.json();
      saveTokens(refreshData.access, refreshData.refresh);
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${refreshData.access}`,
      };
      return fetch(`${API_BASE}${endpoint}`, { ...options, headers: retryHeaders, credentials: 'include' });
    } else {
      clearSessionCookie();
      clearTokens();
      if (typeof window !== 'undefined') window.location.href = '/login?reason=session_expired';
      return new Response(null, { status: 401 });
    }
  }
  return res;
}

export const api = {
  // Login — parses token from response body and saves to localStorage
  login: async (email, password) => {
    const res = await fetch(`${API_BASE}/accounts/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: email, password }),
    });
    if (res.ok) {
      try {
        const data = await res.clone().json();
        saveTokens(data.access, data.refresh);
      } catch { /* tokens already in cookie if same-site */ }
    }
    return res;
  },

  logout: async () => {
    const access = getAccessToken();
    try {
      await fetch(`${API_BASE}/accounts/logout/`, {
        method: 'POST',
        credentials: 'include',
        headers: access ? { Authorization: `Bearer ${access}` } : {},
      });
    } catch {}
    clearSessionCookie();
    clearTokens();
    if (typeof window !== 'undefined') window.location.href = '/login';
  },

  getProfile: () => request('/accounts/profile/'),
  getNotifications: () => request('/accounts/notifications/'),
  markNotificationsRead: (ids) => request('/accounts/notifications/read/', { method: 'POST', body: JSON.stringify(ids ? { ids } : {}) }),
  getUnreadCount: () => request('/accounts/notifications/unread-count/'),

  // Company
  createCompany: (data) => request('/companies/create/', { method: 'POST', body: JSON.stringify(data) }),

  // Facilities
  getFacilities: () => request('/companies/facilities/'),
  createFacility: (data) => request('/companies/facilities/', { method: 'POST', body: JSON.stringify(data) }),

  // Memberships
  getMemberships: () => request('/companies/memberships/'),
  updateMembership: (id, data) => request(`/companies/memberships/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Emissions
  getFactors: (params = '') => request(`/emissions/factors/${params ? '?' + params : ''}`),
  getEntries: (params = '') => request(`/emissions/entries/${params ? '?' + params : ''}`),
  createEntry: (data) => request('/emissions/entries/', { method: 'POST', body: JSON.stringify(data) }),
  createEntryWithFile: (formData) => {
    const access = getAccessToken();
    return fetch(`${API_BASE}/emissions/entries/`, {
      method: 'POST',
      credentials: 'include',
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      body: formData,
    });
  },
  updateEntry: (id, data) => request(`/emissions/entries/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEntry: (id) => request(`/emissions/entries/${id}/`, { method: 'DELETE' }),
  getSummary: (year = 2026) => request(`/emissions/summary/?year=${year}`),

  // Targets
  getTargets: () => request('/emissions/targets/'),
  createTarget: (data) => request('/emissions/targets/', { method: 'POST', body: JSON.stringify(data) }),
  updateTarget: (id, data) => request(`/emissions/targets/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTarget: (id) => request(`/emissions/targets/${id}/`, { method: 'DELETE' }),

  // Custom Emission Requests
  getCustomRequests: () => request('/emissions/custom-requests/'),
  createCustomRequest: (data) => request('/emissions/custom-requests/', { method: 'POST', body: JSON.stringify(data) }),

  // Report
  getReportUrl: (year, lang) => `${API_BASE}/emissions/report/?year=${year}&lang=${lang}`,
  getCsvUrl: (year) => `${API_BASE}/emissions/export-csv/?year=${year}`,
  getExcelUrl: (year) => `${API_BASE}/emissions/export-excel/?year=${year}`,

  // Approval
  approveEntry: (id, action, reason) => request(`/emissions/entries/${id}/approve/`, { method: 'POST', body: JSON.stringify({ action, reason }) }),

  // Facility analytics
  getByFacility: (year) => request(`/emissions/by-facility/?year=${year}`),

  // Pending review
  getPendingEntries: () => request('/emissions/pending/'),

  // Invite
  inviteMember: (data) => request('/companies/invite/', { method: 'POST', body: JSON.stringify(data) }),
  acceptInvite: (token) => request('/companies/accept-invite/', { method: 'POST', body: JSON.stringify({ token }) }),

  // Account
  changePassword: (data) => request('/accounts/change-password/', { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (data) => request('/accounts/update-profile/', { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (password) => request('/accounts/delete-account/', { method: 'DELETE', body: JSON.stringify({ password }) }),
  exportAll: () => request('/emissions/export-all/'),

  // Questionnaire — Legacy
  startQuestionnaire: (lang) => request('/questionnaire/legacy/start/', { method: 'POST', body: JSON.stringify({ lang }) }),
  answerQuestion: (data) => request('/questionnaire/legacy/answer/', { method: 'POST', body: JSON.stringify(data) }),
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

  // CarbonIQ — Grok AI chat (contextual response after each answer)
  aiChat: (data) => request('/questionnaire/ai/chat/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};
