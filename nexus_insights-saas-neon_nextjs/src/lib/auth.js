/**
 * Centralized auth helper — all token operations go through here.
 * Future: migrate to HttpOnly cookies.
 */

export const auth = {
  getAccessToken: () => typeof window !== 'undefined' ? localStorage.getItem('access_token') : null,
  getRefreshToken: () => typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null,

  setTokens: (access, refresh) => {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  },

  clearTokens: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  isAuthenticated: () => !!auth.getAccessToken(),

  logout: () => {
    auth.clearTokens();
    window.location.href = '/login';
  },

  sessionExpired: () => {
    auth.clearTokens();
    localStorage.setItem('session_expired', 'true');
    window.location.href = '/login';
  },
};
