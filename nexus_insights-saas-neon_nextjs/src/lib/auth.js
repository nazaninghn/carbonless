/**
 * Centralized auth helper.
 * Tokens are stored in localStorage for API calls.
 * Backend also sets HttpOnly cookies as secondary auth layer.
 * Future: fully migrate to cookie-only auth.
 */

export const auth = {
  getAccessToken: () => typeof window !== 'undefined' ? localStorage.getItem('access_token') : null,
  getRefreshToken: () => typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null,

  setTokens: (access, refresh) => {
    if (access) localStorage.setItem('access_token', access);
    if (refresh) localStorage.setItem('refresh_token', refresh);
  },

  clearTokens: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  isAuthenticated: () => !!auth.getAccessToken(),

  logout: async () => {
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const token = auth.getAccessToken();
      await fetch(`${API}/accounts/logout/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
    } catch {}
    auth.clearTokens();
    window.location.href = '/login';
  },

  sessionExpired: () => {
    auth.clearTokens();
    window.location.href = '/login?reason=session_expired';
  },
};
