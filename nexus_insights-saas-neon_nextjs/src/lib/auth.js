/**
 * Centralized auth helper — cookie-based.
 * Tokens are stored in HttpOnly cookies by the backend.
 * This helper provides logout and authenticated fetch utilities.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const auth = {
  async logout() {
    try {
      await fetch(`${API_BASE}/accounts/logout/`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}
    window.location.href = '/login';
  },

  sessionExpired() {
    window.location.href = '/login?reason=session_expired';
  },

  async fetchWithAuth(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      auth.sessionExpired();
    }

    return res;
  },
};
