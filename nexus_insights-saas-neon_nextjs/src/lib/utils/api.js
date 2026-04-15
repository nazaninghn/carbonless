const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Store tokens for header-based auth (dev cross-origin fallback)
function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('_dev_access_token');
}
function setStoredToken(token) {
  if (typeof window !== 'undefined' && token) localStorage.setItem('_dev_access_token', token);
}
function clearStoredToken() {
  if (typeof window !== 'undefined') localStorage.removeItem('_dev_access_token');
}

export function setAccessToken(token) { setStoredToken(token); }

async function request(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getStoredToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    // Try refresh
    const refreshRes = await fetch(`${API_BASE}/accounts/token/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (refreshRes.ok) {
      // Check if new access token in body (dev mode)
      try {
        const refreshData = await refreshRes.json();
        if (refreshData.access) setStoredToken(refreshData.access);
      } catch {}
      const newToken = getStoredToken();
      if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
      return fetch(`${API_BASE}${endpoint}`, { ...options, headers, credentials: 'include' });
    } else {
      _accessToken = null;
      clearStoredToken();
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

  // Account
  changePassword: (data) => request('/accounts/change-password/', { method: 'POST', body: JSON.stringify(data) }),

  // Emission entry update
  updateEntry: (id, data) => request(`/emissions/entries/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Questionnaire
  startQuestionnaire: (lang) => request('/questionnaire/start/', { method: 'POST', body: JSON.stringify({ lang }) }),
  answerQuestion: (data) => request('/questionnaire/answer/', { method: 'POST', body: JSON.stringify(data) }),
  getQuestionnaireSessions: () => request('/questionnaire/sessions/'),
  resetQuestionnaire: () => request('/questionnaire/reset/', { method: 'POST' }),
  getQuestionnaireProfile: () => request('/questionnaire/profile/'),
};
