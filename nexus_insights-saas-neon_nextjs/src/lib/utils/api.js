const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// ── Session indicator cookie (client-readable, used by middleware for routing) ──
// NOT the auth token — actual auth is the HttpOnly JWT cookie set by the backend.
export function markSessionActive() {
  if (typeof document === 'undefined') return;
  document.cookie = 'carbonless_auth=1; path=/; SameSite=Lax; Max-Age=86400';
}
export function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'carbonless_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
}

async function request(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    // Try silent refresh via HttpOnly refresh cookie
    const refreshRes = await fetch(`${API_BASE}/accounts/token/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (refreshRes.ok) {
      return fetch(`${API_BASE}${endpoint}`, { ...options, headers, credentials: 'include' });
    } else {
      clearSessionCookie();
      if (typeof window !== 'undefined') window.location.href = '/login?reason=session_expired';
      return new Response(null, { status: 401 });
    }
  }
  return res;
}

export const api = {
  login: (email, password) =>
    fetch(`${API_BASE}/accounts/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: email, password }),
    }),

  logout: async () => {
    try {
      await fetch(`${API_BASE}/accounts/logout/`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}
    clearSessionCookie();
    if (typeof window !== 'undefined') window.location.href = '/login';
  },

  getProfile: () => request('/accounts/profile/'),
  getNotifications: () => request('/accounts/notifications/'),
  markNotificationsRead: (ids) => request('/accounts/notifications/read/', { method: 'POST', body: JSON.stringify(ids ? { ids } : {}) }),
  getUnreadCount: () => request('/accounts/notifications/unread-count/'),

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
  createEntryWithFile: (formData) =>
    fetch(`${API_BASE}/emissions/entries/`, { method: 'POST', credentials: 'include', body: formData }),
  updateEntry: (id, data) => request(`/emissions/entries/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEntry: (id) => request(`/emissions/entries/${id}/`, { method: 'DELETE' }),
  getSummary: (year = 2026) => request(`/emissions/summary/?year=${year}`),

  // Targets
  getTargets: () => request('/emissions/targets/'),
  createTarget: (data) => request('/emissions/targets/', { method: 'POST', body: JSON.stringify(data) }),

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
};
