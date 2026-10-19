// The dashboard's reporting year (the header's year picker). It used to start
// at the calendar year on every page load, so someone working on a 2025
// inventory saw empty 2026 pages after each refresh — Reports even kept that
// inventory's downloads disabled. It now starts at the year the user last
// worked on, else at the year of their most recently updated inventory.

const KEY_PREFIX = 'carbonless_selected_year';

export function isReportingYear(year, now = new Date()) {
  const y = Number(year);
  return Number.isInteger(y) && y >= 1990 && y <= now.getFullYear();
}

// Per user: a shared computer must not open one account on another's year.
export function rememberedYear(userId, storage) {
  if (!userId || !storage) return null;
  try {
    const y = Number(storage.getItem(`${KEY_PREFIX}:${userId}`));
    return isReportingYear(y) ? y : null;
  } catch {
    return null;
  }
}

export function rememberYear(userId, year, storage) {
  if (!userId || !storage || !isReportingYear(year)) return;
  try { storage.setItem(`${KEY_PREFIX}:${userId}`, String(year)); } catch { /* falls back to the inventory's year */ }
}

// reports: GET /api/questionnaire/ — newest-updated first.
export function defaultReportingYear(reports, now = new Date()) {
  const latest = (Array.isArray(reports) ? reports : []).find(r => isReportingYear(r?.reporting_year, now));
  return latest ? Number(latest.reporting_year) : now.getFullYear();
}

// The signed-in user's id from the stored access token (a JWT whose payload
// carries user_id), so the year can be chosen before any request returns.
export function tokenUserId(storage) {
  try {
    const token = storage?.getItem('_ca');
    const payload = token && token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const id = JSON.parse(json).user_id;
    return id === undefined || id === null ? null : String(id);
  } catch {
    return null;
  }
}
