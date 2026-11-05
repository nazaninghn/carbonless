// @ts-check
// Incremental TypeScript adoption: JSDoc types enable full IDE intellisense and
// tsc --checkJs validation without requiring a full .ts rewrite.

import { hasUnsaved } from '@/lib/session/unsaved';
import { KEY_ACTIVITY, KEY_ENDED, KEY_UNSAVED_NOTE } from '@/lib/session/idle';

/** @type {string} */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Session cookie for Next.js middleware routing (first-party, not auth)
/** @returns {void} */
export function markSessionActive() {
  if (typeof document === 'undefined') return;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `carbonless_auth=1; path=/; SameSite=Lax; Max-Age=86400${secure}`;
}
export function clearSessionCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'carbonless_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
}

// Access token (memory + localStorage)
/** @type {string | null} */
let _token = null;
/** @type {Promise<{ok: boolean, access: string | null, transient?: boolean}> | null} */
let _refreshPromise = null;

/** @returns {string | null} */
function getToken() {
  if (_token) return _token;
  if (typeof window !== 'undefined') {
    _token = localStorage.getItem('_ca') || null;
  }
  return _token;
}

/** @param {string | null} t */
function setToken(t) {
  _token = t;
  if (typeof window !== 'undefined') {
    if (t) localStorage.setItem('_ca', t);
    else localStorage.removeItem('_ca');
  }
}

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * fetch() with a hard 30 s abort timeout.
 * @param {string} url
 * @param {RequestInit} [opts]
 * @returns {Promise<Response>}
 */
function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const toApi = url.startsWith(API_BASE);
  const headers = toApi ? { ...companyHeader(), ...(opts.headers || {}) } : opts.headers;
  return fetch(url, { ...opts, headers, signal: controller.signal })
    .then(res => (toApi ? guardCompany(res) : res))
    .finally(() => clearTimeout(timer));
}

// The company this page was opened with. Every API call names it; when
// another tab has switched the user to another company the server answers
// 409 company_changed and the page reloads in the new company, instead of
// showing (and saving into) the other company under this one's name.
/** @type {string | null} */
let _companyId = null;
/** @param {number | string | null} id */
export function setCompanyContext(id) {
  _companyId = id ? String(id) : null;
  _sharedGets?.clear();
}
/** @returns {Record<string, string>} */
export function companyHeader() {
  return _companyId ? { 'X-Company-Id': _companyId } : {};
}
export const COMPANY_CHANGED_KEY = 'carbonless_company_changed';
/** @param {Response} res */
async function guardCompany(res) {
  if (res.status !== 409 || typeof window === 'undefined' || !_companyId) return res;
  const body = await res.clone().json().catch(() => null);
  if (body?.code !== 'company_changed' || !body.active_company) return res;
  try { sessionStorage.setItem(COMPANY_CHANGED_KEY, body.active_company.name || ''); } catch {}
  _companyId = null;
  window.location.reload();
  return new Promise(() => {}); // the page is reloading
}

/**
 * Authenticated fetch — auto-attaches Bearer token + retries on 401 via doRefresh().
 * @param {string} endpoint  API path relative to API_BASE (e.g. '/accounts/profile/')
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
// Read-only endpoints that several dashboard components each load when they
// mount (the sidebar, the library, the assistant, the data hook …): one page
// load sent /accounts/profile/ five times and /companies/my-companies/ three.
// Identical GETs within SHARED_GET_MS share one network call; every caller
// gets its own clone of the response. Any write clears the shared answers,
// so data changed by the user is never served stale.
const SHARED_GET_ENDPOINTS = new Set([
  '/accounts/profile/', '/companies/my-companies/', '/companies/detail/',
  '/questionnaire/', '/chat/sessions/', '/support/requests/',
]);
const SHARED_GET_MS = 2000;
const _sharedGets = new Map();

export function clearSharedRequests() {
  _sharedGets.clear();
}

async function request(endpoint, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    clearSharedRequests();
    return sendRequest(endpoint, options);
  }
  if (!SHARED_GET_ENDPOINTS.has(endpoint) || options.body) return sendRequest(endpoint, options);
  const key = `${endpoint}|${_companyId || ''}|${getToken() || ''}|${JSON.stringify(options.headers || {})}`;
  let shared = _sharedGets.get(key);
  if (!shared) {
    const promise = sendRequest(endpoint, options);
    shared = { promise };
    _sharedGets.set(key, shared);
    const forget = () => { if (_sharedGets.get(key) === shared) _sharedGets.delete(key); };
    // A failed answer is not shared beyond the callers already waiting.
    promise.then(r => (r.ok ? setTimeout(forget, SHARED_GET_MS) : forget()), forget);
  }
  const res = await shared.promise;
  return res.clone();
}

async function sendRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status !== 401) return res;

  const refreshResult = await doRefresh();
  if (!refreshResult?.ok) return new Response(null, { status: refreshResult?.transient ? 503 : 401 });

  const { access } = refreshResult;
  // Token already written inside doRefresh; setToken here keeps the path symmetric.
  setToken(access);

  return fetchWithTimeout(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { ...headers, Authorization: `Bearer ${access}` },
    credentials: 'include',
  });
}

// Singleton refresh: one network call for any number of concurrent 401s.
// The promise resolves with { ok, access }; body is consumed once and shared.
// _refreshPromise is cleared INSIDE .then() — after the token is written —
// so concurrent callers that arrive in the tiny gap wait for the token,
// not start a second refresh.
// One token refresh at a time across ALL tabs of this browser (Web Locks): two tabs refreshing together would present
// the same rotating refresh token twice, and the second would be refused and sign the user out.
async function withRefreshLock(fn) {
  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    return navigator.locks.request('carbonless-token-refresh', fn);
  }
  return fn();
}

// One refresh round trip. If it gets no answer (a dropped connection, a timeout, a 5xx from the proxy) the SAME attempt,
// with the same attempt id, is repeated a couple of times: the server may already have rotated the token, and the repeat
// is how it gives the user a working one instead of leaving them with a dead cookie (accounts/session.py). `keepalive`
// lets the request finish, and its Set-Cookie be stored, even when the page navigates away meanwhile.
const REFRESH_RETRY_DELAYS_MS = [1000, 3000];
const newAttemptId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

async function refreshRequest(extraHeaders = {}) {
  const attempt = newAttemptId();
  for (let i = 0; ; i++) {
    let res = null;
    try {
      res = await fetchWithTimeout('/api/auth/refresh', {
        method: 'POST', credentials: 'include', keepalive: true,
        headers: { 'x-refresh-attempt': attempt, ...extraHeaders },
      });
    } catch { res = null; }
    if (res && res.status < 500) return { response: res };         // an answer: success or a definite refusal
    if (i >= REFRESH_RETRY_DELAYS_MS.length) return { transient: true };
    await new Promise((resolve) => setTimeout(resolve, REFRESH_RETRY_DELAYS_MS[i]));
  }
}

// The automatic refresh (after an expired access token): it never reports user activity, so it can never extend an
// inactive session. The server decides whether the session is still alive.
let _refreshPausedUntil = 0;   // after a refresh got no answer, other requests do not start more of them for a while
const REFRESH_PAUSE_MS = 10_000;

async function doRefresh() {
  if (!_refreshPromise && Date.now() < _refreshPausedUntil) return { ok: false, access: null, transient: true };
  if (!_refreshPromise) {
    const tokenWhenAsked = typeof window !== 'undefined' ? localStorage.getItem('_ca') : null;
    _refreshPromise = withRefreshLock(async () => {
      // another tab may have refreshed while this one waited for the lock: use its token
      const stored = typeof window !== 'undefined' ? localStorage.getItem('_ca') : null;
      if (stored && stored !== tokenWhenAsked) { _token = stored; return { ok: true, access: stored }; }
      const { response: rr, transient } = await refreshRequest();
      if (transient) return { ok: false, access: null, transient: true };   // no answer: not a reason to sign anyone out
      if (!rr.ok) return { ok: false, access: null };                       // the server refused: the session is over
      const data = await rr.json();
      const access = data.access || null;
      if (access) setToken(access);
      return { ok: !!access, access };
    })
      .catch(() => ({ ok: false, access: null, transient: true }))
      .finally(() => { _refreshPromise = null; });
  }
  const result = await _refreshPromise;
  if (result?.transient) _refreshPausedUntil = Date.now() + REFRESH_PAUSE_MS;
  if (!result?.ok && !result?.transient) endSession();
  return result;
}

/**
 * End the session in this browser: forget the credentials and go to the login page with the "session expired" notice.
 * Nothing is deleted anywhere: saved answers, inventories, reports and every other record stay as they are.
 * An answer typed but never submitted cannot be kept (it was never saved), so the login page says so.
 */
function endSession() {
  if (typeof window === 'undefined') return;
  try { if (hasUnsaved()) sessionStorage.setItem(KEY_UNSAVED_NOTE, '1'); } catch { /* storage unavailable */ }
  setToken(null);
  clearSessionCookie();
  try {
    localStorage.removeItem(KEY_ACTIVITY);
    localStorage.setItem(KEY_ENDED, String(Date.now()));   // the other tabs see this and follow
  } catch { /* storage unavailable */ }
  window.location.href = '/login?reason=session_expired';
}

/**
 * The inactivity limit was reached in the browser: clear the refresh cookie on the server side of the app, then end
 * the session. (The backend already refuses the tokens by themselves: this only tidies up.)
 */
export async function expireSession() {
  try {
    await fetchWithTimeout('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch { /* the cookie is cleared by the redirect's own checks; the server refuses the tokens anyway */ }
  endSession();
}

/**
 * Tell the server the user has been active, which extends the session. `ageSeconds` is called INSIDE the cross-tab
 * lock (after any other tab's extension is visible) and returns the seconds since the user's last activity, or null
 * to skip. Resolves { ok } when extended, { expired: true } when the server says the session is over, and { ok: false }
 * for anything else (offline, server error): those never sign the user out, the next check tries again.
 * @param {() => number | null} ageSeconds
 */
export async function extendSession(ageSeconds) {
  if (_refreshPromise) return { ok: false };           // an automatic refresh is under way; try again at the next check
  return withRefreshLock(async () => {
    const age = ageSeconds();
    if (age == null) return { ok: false, skipped: true };
    try {
      const { response: rr } = await refreshRequest({ 'x-user-activity': String(Math.max(0, Math.floor(age))) });
      if (!rr) return { ok: false };                       // no answer after the retries: try again at the next check
      if (rr.status === 401) {
        // Only the server's own "ended for inactivity" ends the session here. Any other refusal (no refresh cookie, a
        // token problem) is left to the normal path: the next API call that gets a 401 refreshes and handles it.
        const body = await rr.json().catch(() => null);
        return body?.code === 'session_expired' ? { ok: false, expired: true } : { ok: false };
      }
      if (!rr.ok) return { ok: false };
      const data = await rr.json().catch(() => null);
      if (!data?.access) return { ok: false };
      setToken(data.access);
      markSessionActive();                              // the routing cookie follows the activity: no fixed 24 h cut-off
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });
}

export const api = {
  login: async (credential, password) => {
    const c = typeof credential === 'string' ? credential.trim() : credential;
    // Use fetchWithTimeout (30 s) so a hung login proxy does not permanently
    // freeze the submit button in the loading state.
    const res = await fetchWithTimeout('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Send both fields so the backend can match by username OR email
      // depending on which Django auth backend is configured.
      body: JSON.stringify({ username: c, email: c, password }),
    });
    if (res.ok) {
      const d = await res.clone().json().catch(() => ({}));
      if (d.access) setToken(d.access);
    }
    return res;
  },

  // Verifies the signup code; on success the route also signs the user in.
  verifyEmailCode: async (email, code) => {
    const res = await fetchWithTimeout('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    if (res.ok) {
      const d = await res.clone().json().catch(() => ({}));
      if (d.access) setToken(d.access);
    }
    return res;
  },

  googleLogin: async (credential) => {
    const res = await fetchWithTimeout('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    if (res.ok) {
      const d = await res.clone().json().catch(() => ({}));
      if (d.access) setToken(d.access);
    }
    return res;
  },

  // strict (opt-in): if the logout request fails or is refused, nothing is cleared,
  // there is no redirect, and { ok: false } comes back so the caller can say so (the
  // user is still signed in). Without it — every existing caller — a failed request
  // still signs the browser out, as before.
  logout: async ({ strict = false } = {}) => {
    const token = getToken();
    try {
      // fetchWithTimeout ensures a hung logout endpoint cannot prevent
      // setToken(null) / clearSessionCookie() / the redirect from running.
      // Fix #60: credentials:'include' sends the HttpOnly refresh_token cookie so
      // the backend blacklists it (Fix #55).  Without it the blacklist never fires.
      const res = await fetchWithTimeout('/api/auth/logout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (strict && !res.ok) return { ok: false };
    } catch {
      if (strict) return { ok: false };
    }
    setToken(null);
    clearSessionCookie();
    if (typeof window !== 'undefined') window.location.href = '/login';
  },

  getProfile: () => request('/accounts/profile/'),
  getNotifications: () => request('/accounts/notifications/'),
  markNotificationsRead: (ids) => request('/accounts/notifications/read/', { method: 'POST', body: JSON.stringify(ids ? { ids } : {}) }),
  getUnreadCount: () => request('/accounts/notifications/unread-count/'),

  getCompanyDetail: () => request('/companies/detail/'),
  updateCompany: (data) => request('/companies/detail/', { method: 'PATCH', body: JSON.stringify(data) }),
  createCompany: (data) => request('/companies/create/', { method: 'POST', body: JSON.stringify(data) }),

  getFacilities: () => request('/companies/facilities/'),
  createFacility: (data) => request('/companies/facilities/', { method: 'POST', body: JSON.stringify(data) }),
  updateFacility: (id, data) => request(`/companies/facilities/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteFacility: (id) => request(`/companies/facilities/${id}/`, { method: 'DELETE' }),
  // An approver accepts ('approve') or declines ('reject') the grid connection
  // a data-entry member gave for the facility in Q24.
  decideFacilityConnection: (id, decision) => request(`/companies/facilities/${id}/connection-decision/`, { method: 'POST', body: JSON.stringify({ decision }) }),

  getMemberships: () => request('/companies/memberships/'),
  updateMembership: (id, data) => request(`/companies/memberships/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),

  getScope3Categories: () => request('/emissions/scope3-categories/'),
  getFactors: (params = '') => request(`/emissions/factors/${params ? '?' + params : ''}`),
  getEntries: (params = '') => request(`/emissions/entries/${params ? '?' + params : ''}`),
  createEntry: (data) => request('/emissions/entries/', { method: 'POST', body: JSON.stringify(data) }),
  createEntryWithFile: async (formData) => {
    // FormData uploads cannot use request() (which sets Content-Type: application/json),
    // so we handle the 401 token-refresh path manually here.
    // Fix 24C: use fetchWithTimeout() on both paths so hung uploads don't stall forever.
    const token = getToken();
    const res = await fetchWithTimeout(`${API_BASE}/emissions/entries/`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (res.status !== 401) return res;
    const refreshResult = await doRefresh();
    if (!refreshResult?.ok) return new Response(null, { status: refreshResult?.transient ? 503 : 401 });
    return fetchWithTimeout(`${API_BASE}/emissions/entries/`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${refreshResult.access}` },
      body: formData,
    });
  },
  updateEntry: (id, data) => request(`/emissions/entries/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  // Attach or replace an existing entry's proof document (multipart, so it
  // cannot go through request(), which sends JSON — same refresh path as
  // createEntryWithFile).
  uploadProof: async (id, file) => {
    const send = (token) => {
      const fd = new FormData();
      fd.append('proof_document', file);
      return fetchWithTimeout(`${API_BASE}/emissions/entries/${id}/proof/`, {
        method: 'POST', credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
    };
    const res = await send(getToken());
    if (res.status !== 401) return res;
    const refreshResult = await doRefresh();
    if (!refreshResult?.ok) return new Response(null, { status: refreshResult?.transient ? 503 : 401 });
    return send(refreshResult.access);
  },
  removeProof: (id) => request(`/emissions/entries/${id}/proof/`, { method: 'DELETE' }),
  deleteEntry: (id) => request(`/emissions/entries/${id}/`, { method: 'DELETE' }),
  cancelDeleteRequest: (id) => request(`/emissions/entries/${id}/cancel-delete/`, { method: 'POST' }),
  // inventoryId names ONE inventory (several can share a year); the server checks it is the caller's.
  getSummary: (year = new Date().getFullYear(), inventoryId = null) =>
    request(`/emissions/summary/?year=${year}${inventoryId ? `&inventory_id=${inventoryId}` : ''}`),

  getTargets: () => request('/emissions/targets/'),
  createTarget: (data) => request('/emissions/targets/', { method: 'POST', body: JSON.stringify(data) }),
  updateTarget: (id, data) => request(`/emissions/targets/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTarget: (id) => request(`/emissions/targets/${id}/`, { method: 'DELETE' }),

  getCustomRequests: () => request('/emissions/custom-requests/'),
  createCustomRequest: (data) => request('/emissions/custom-requests/', { method: 'POST', body: JSON.stringify(data) }),
  deleteCustomRequest: (id) => request(`/emissions/custom-requests/${id}/`, { method: 'DELETE' }),

  downloadReport: (year, lang, inventoryId = null) =>
    request(`/emissions/report/?year=${year}&lang=${lang}${inventoryId ? `&inventory_id=${inventoryId}` : ''}`),
  downloadCsv: (year, lang = 'en', inventoryId = null) =>
    request(`/emissions/export-csv/?year=${year}&lang=${lang}${inventoryId ? `&inventory_id=${inventoryId}` : ''}`),
  downloadExcel: (year, lang = 'en', inventoryId = null) =>
    request(`/emissions/export-excel/?year=${year}&lang=${lang}${inventoryId ? `&inventory_id=${inventoryId}` : ''}`),

  approveEntry: (id, action, reason) => request(`/emissions/entries/${id}/approve/`, { method: 'POST', body: JSON.stringify({ action, reason }) }),
  downloadProofDocument: (entryId) => request(`/emissions/entries/${entryId}/proof/`),
  getByFacility: (year, inventoryId = null) =>
    request(`/emissions/by-facility/?year=${year}${inventoryId ? `&inventory_id=${inventoryId}` : ''}`),
  // lang names the questions in the reviewer's language ("Question 24" / "Soru 24").
  getPendingEntries: (lang) => request(`/emissions/pending/${lang ? `?lang=${lang}` : ''}`),

  // Danışman Onayı (Advisor Approval) — questionnaire answers flagged by the
  // 32-rule trigger system (custom EF override, RFI applied, K3 category "No", etc.)
  getPendingAdvisorApprovals: () => request('/questionnaire/advisor-approvals/pending/'),
  approveAdvisorApproval: (id, action, reason) => request(`/questionnaire/advisor-approvals/${id}/approve/`, { method: 'POST', body: JSON.stringify({ action, reason }) }),

  inviteMember: (data) => request('/companies/invite/', { method: 'POST', body: JSON.stringify(data) }),
  getInvites: () => request('/companies/invites/'),
  cancelInvite: (id) => request(`/companies/invites/${id}/`, { method: 'DELETE' }),
  acceptInvite: (token) => request('/companies/accept-invite/', { method: 'POST', body: JSON.stringify({ token }) }),
  getMyCompanies: () => request('/companies/my-companies/'),
  transferOwnership: (membershipId, password) => request('/companies/transfer-ownership/', { method: 'POST', body: JSON.stringify({ membership_id: membershipId, password }) }),
  switchCompany: (companyId) => request('/companies/switch/', { method: 'POST', body: JSON.stringify({ company_id: companyId }) }),

  changePassword: (data) => request('/accounts/change-password/', { method: 'POST', body: JSON.stringify(data) }),
  updateProfile: (data) => request('/accounts/update-profile/', { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (password) => request('/accounts/delete-account/', { method: 'DELETE', body: JSON.stringify({ password }) }),
  exportAll: () => request('/emissions/export-all/'),
  exportAllExcel: (lang = 'en') => request(`/emissions/export-all/?file=xlsx&lang=${lang}`),

  startCarbonReport: (title = '', forceNew = false, reportingYear = null) => request('/questionnaire/start/', {
    method: 'POST',
    body: JSON.stringify({ title, force_new: forceNew, ...(reportingYear ? { reporting_year: reportingYear } : {}) })
  }),
  resetQuestionnaire: () => request('/questionnaire/reset/', { method: 'POST' }),
  restartReport: (reportId) => request(`/questionnaire/${reportId}/restart/`, { method: 'POST' }),
  // extra: { confirm_company_update: true } once the user agreed that a
  // profile answer may change the company record (409 company_conflict).
  submitReportStep: (reportId, step, data, language, progress, extra = {}) => request(`/questionnaire/${reportId}/step/`, {
    method: 'PATCH',
    body: JSON.stringify({ step, data, language, progress, ...extra }),
  }),
  saveReportDraft: (reportId, data) => request(`/questionnaire/${reportId}/draft/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  renameReport: (reportId, title) => request(`/questionnaire/${reportId}/title/`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  }),
  getReportStatus: (reportId) => request(`/questionnaire/${reportId}/`),
  getCompanyHistory: (lang) => request(`/accounts/history/${lang ? `?lang=${lang}` : ''}`),
  getReportAssumptions: (reportId, lang) => request(`/questionnaire/${reportId}/assumptions/?lang=${lang === 'en' ? 'en' : 'tr'}`),
  getPreviousCompanyProfile: (reportId) => request(`/questionnaire/${reportId}/previous-profile/`),
  reuseCompanyProfile: (reportId, reportingYear, progress = null) => request(`/questionnaire/${reportId}/reuse-profile/`, { method: 'POST', body: JSON.stringify({ reporting_year: reportingYear, ...(progress ? { progress } : {}) }) }),
  // "I don't know — answer later": mark (pending=true) or unmark a question; saves no answer.
  setPendingQuestion: (reportId, step, pending, language) => request(`/questionnaire/${reportId}/pending/`, {
    method: 'POST',
    body: JSON.stringify({ step, pending, language }),
  }),
  deleteReport: (reportId) => request(`/questionnaire/${reportId}/`, { method: 'DELETE' }),
  downloadQuestionnairePdf: (reportId, lang = 'en') => request(`/questionnaire/${reportId}/pdf/?lang=${lang}`),
  // The full ISO 14064-1:2018 inventory report (six categories, boundaries,
  // methodology, significance and uncertainty) — distinct from the short
  // questionnaire profile above.
  downloadIsoReport: (reportId, lang = 'en') => request(`/questionnaire/${reportId}/iso-report/?lang=${lang}`),
  // All three reports bound into one PDF — the ISO report, the questionnaire
  // profile and the quantified emissions summary — with continuous page
  // numbering and bookmarks. `year` scopes the emissions part and defaults
  // server-side to the inventory's own reporting year.
  downloadCombinedReport: (reportId, lang = 'en', year) =>
    request(`/questionnaire/${reportId}/combined-report/?lang=${lang}` + (year ? `&year=${year}` : '')),
  listReports: () => request('/questionnaire/'),

  // Chat sessions
  getChatSessions: () => request('/chat/sessions/'),
  createChatSession: (title = 'New Chat') => request('/chat/sessions/new/', { method: 'POST', body: JSON.stringify({ title }) }),
  getChatSession: (id) => request(`/chat/sessions/${id}/`),
  deleteChatSession: (id) => request(`/chat/sessions/${id}/`, { method: 'DELETE' }),
  // inventoryId: the inventory the user is working in; the assistant then reads only that inventory's records.
  sendChatMessage: (sessionId, content, language, inventoryId = null) => request(`/chat/sessions/${sessionId}/message/`, {
    method: 'POST', body: JSON.stringify(inventoryId ? { content, language, inventory_id: Number(inventoryId) } : { content, language }) }),
  sendChatMessageWithFile: (sessionId, formData) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('_ca') : null;
    /** @type {Record<string, string>} */
    const headers = { ...companyHeader() };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/chat/sessions/${sessionId}/message/`, {
      method: 'POST',
      headers: /** @type {HeadersInit} */ (headers),
      body: formData,
      credentials: 'include',
    });
  },
  sendAnswerFeedback: (messageId, helpful, comment = '') => request('/support/feedback/', { method: 'POST', body: JSON.stringify({ message_id: messageId, helpful, comment }) }),
  getSupportRequests: () => request('/support/requests/'),
  replyToSupport: (id, message) => request(`/support/requests/${id}/reply/`, { method: 'POST', body: JSON.stringify({ message }) }),
  askSupport: (question, sessionId, language) => request('/support/requests/', { method: 'POST', body: JSON.stringify({ question, session_id: sessionId, language }) }),
  confirmEmissionEntry: (entryData) => request('/chat/confirm-entry/', { method: 'POST', body: JSON.stringify(entryData) }),
  downloadChatAttachment: (messageId) => request(`/chat/messages/${messageId}/attachment/`),
};

/**
 * Low-level authenticated fetch — exported so workspace/ai helpers can call
 * arbitrary endpoints without duplicating the auth + refresh logic.
 * Usage: import { request } from '@/lib/utils/api'
 */
export { request };
