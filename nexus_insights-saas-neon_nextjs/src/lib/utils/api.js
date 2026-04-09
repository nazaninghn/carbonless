const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

async function request(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    // Try cookie-based refresh
    const refreshRes = await fetch(`${API_BASE}/accounts/token/refresh/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (refreshRes.ok) {
      return fetch(`${API_BASE}${endpoint}`, { ...options, headers, credentials: 'include' });
    } else {
      window.location.href = '/login?reason=session_expired';
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
