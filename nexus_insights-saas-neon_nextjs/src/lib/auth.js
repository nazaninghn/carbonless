/**
 * Centralized auth helper — cookie-based with silent refresh.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

async function tryRefresh() {
  try {
    const res = await fetch(`${API_BASE}/accounts/token/refresh/`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

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

  async fetchWithAuth(url, options = {}) {
    let res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    // Silent refresh on 401
    if (res.status === 401) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        res = await fetch(url, {
          ...options,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
          },
        });
      }
    }

    // Still 401 after refresh attempt → session expired
    if (res.status === 401) {
      window.location.href = '/login?reason=session_expired';
    }

    return res;
  },
};
