const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// ── Session cookie for Next.js middleware routing (first-party, not auth) ─────
export function markSessionActive() {
  if (typeof document === 'undefined') return;
  document.cookie = 'carbonless_auth=1; path=/; SameSite=Lax; Max-Age=86400';
}
export function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'carbonless_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
}

// ── Access token (memory + localStorage) ─────────────────────────────────────
let _token = null;

function getToken() {
  if (_token) return _token;
  if (typeof window !== 'undefined') {
    _token = localStorage.getItem('_ca') || null;
  }
  return _token;
}

function setToken(t) {
  _token = t;
  if (typeof window !== 'undefined') {
    if (t) localStorage.setItem('_ca', t);
    else localStorage.removeItem('_ca');
  }
}

// ── Authenticated fetch ───────────────────────────────────────────────────────
async function request(endpoint, options = {}) {
  const token = getToken();
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

  // Silent refresh via same-origin Next.js route (no cross-site cookie issues)
  const rr = await fetch('/api/auth/refresh', { method: 'POST' }).catch(() => null);
  if (!rr?.ok) {
    setToken(null);
    clearSessionCookie();
    if (typeof window !== 'undefined') window.location.href = '/login?reason=session_expired';
    return new Response(null, { status: 401 });
  }

  const { access } = await rr.json();
  setToken(access);

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { ...headers, Authorization: `Bearer ${access}` },
    credentials: 'include',
  });
}

export const api = {
  // Login via Next.js proxy — same-origin, no cross-site cookie issues on any browser
  login: async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
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
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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

  createCompany: (data) => request('/companies/create/', { method: 'POST', body: JSON.stringify(data) }),

  getFacilities: () => request('/companies/facilities/'),
  createFacility: (data) => request('/companies/facilities/', { method: 'POST', body: JSON.stringify(data) }),

  getMemberships: () => request('/companies/memberships/'),
  updateMembership: (id, data) => request(`/companies/memberships/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),

  getFactors: (params = '') => request(`/emissions/factors/${params ? '?' + params : ''}`),
  getEntries: (params = '') => request(`/emissions/entries/${params ? '?' + params : ''}`),
  createEntry: (data) => request('/emissions/entries/', { method: 'POST', body: JSON.stringify(data) }),
  createEntryWithFile: (formData) => {
    const token = getToken();
    return fetch(`${API_BASE}/emissions/entries/`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  },
  updateEntry: (id, data) => request(`/emissions/entries/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEntry: (id) => request(`/emissions/entries/${id}/`, { method: 'DELETE' }),
  getSummary: (year = 2026) => request(`/emissions/summary/?year=${year}`),

  getTargets: () => request('/emissions/targets/'),
  createTarget: (data) => request('/emissions/targets/', { method: 'POST', body: JSON.stringify(data) }),
  updateTarget: (id, data) => request(`/emissions/targets/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTarget: (id) => request(`/emissions/targets/${id}/`, { method: 'DELETE' }),

  getCustomRequests: () => request('/emissions/custom-requests/'),
  createCustomRequest: (data) => request('/emissions/custom-requests/', { method: 'POST', body: JSON.stringify(data) }),

  getReportUrl: (year, lang) => `${API_BASE}/emissions/report/?year=${year}&lang=${lang}`,
  getCsvUrl: (year) => `${API_BASE}/emissions/export-csv/?year=${year}`,
  getExcelUrl: (year) => `${API_BASE}/emissions/export-excel/?year=${year}`,

  approveEntry: (id, action, reason) => request(`/emissions/entries/${id}/approve/`, { method: 'POST', body: JSON.stringify({ action, reason }) }),
  getByFacility: (year) => request(`/emissions/by-facility/?year=${year}`),
  getPendingEntries: () => request('/emissions/pending/'),

  inviteMember: (data) => request('/companies/invite/', { method: 'POST', body: JSON.stringify(data) }),
  acceptInvite: (token) => request('/companies/accept-invite/', { method: 'POST', body: JSON.stringify({ token }) }),

  changePassword: (data) => request('/accounts/change-password/', { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (data) => request('/accounts/update-profile/', { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (password) => request('/accounts/delete-account/', { method: 'DELETE', body: JSON.stringify({ password }) }),
  exportAll: () => request('/emissions/export-all/'),

  startQuestionnaire: (lang) => request('/questionnaire/legacy/start/', { method: 'POST', body: JSON.stringify({ lang }) }),
  answerQuestion: (data) => request('/questionnaire/legacy/answer/', { method: 'POST', body: JSON.stringify(data) }),
  getQuestionnaireSessions: () => request('/questionnaire/legacy/sessions/'),
  resetQuestionnaire: () => request('/questionnaire/legacy/reset/', { method: 'POST' }),
  getQuestionnaireProfile: () => request('/questionnaire/legacy/profile/'),

  startCarbonReport: () => request('/questionnaire/start/', { method: 'POST' }),
  submitReportStep: (reportId, step, data) => request(`/questionnaire/${reportId}/step/`, {
    method: 'PATCH',
    body: JSON.stringify({ step, data }),
  }),
  getReportStatus: (reportId) => request(`/questionnaire/${reportId}/`),
  listReports: () => request('/questionnaire/'),

  aiChat: (data) => request('/questionnaire/ai/chat/', { method: 'POST', body: JSON.stringify(data) }),
};
