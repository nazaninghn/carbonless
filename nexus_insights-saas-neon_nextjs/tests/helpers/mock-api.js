/**
 * Playwright API mock helper — tests/helpers/mock-api.js
 *
 * Intercepts every request to the Django backend (http://localhost:8000/api/**)
 * and the Next.js auth route handlers (/api/auth/**) so smoke tests run without
 * a real backend.
 *
 * Usage:
 *   import { mockDjangoApi, MOCK_TOKEN, seedAuth } from '../helpers/mock-api.js';
 *
 *   test('...', async ({ page }) => {
 *     await mockDjangoApi(page);   // mock all backend calls
 *     await seedAuth(page);        // set cookie + localStorage token
 *     await page.goto('/dashboard');
 *     ...
 *   });
 */

/** Fake JWT-like access token used across tests. */
export const MOCK_TOKEN = 'e2e-smoke-mock-access-token';

/** Canned stub data returned for each Django endpoint. */
const STUBS = {
  profile: {
    id: 1, username: 'smokeuser', email: 'smoke@carbonless.com',
    first_name: 'Smoke', is_staff: false,
  },
  summary: {
    total_tonne: 25.4,
    scope1_tonne: 10.2, scope2_tonne: 8.6, scope3_tonne: 6.6,
    monthly: [],
    questionnaire_profile: null,
  },
  unreadCount: { unread_count: 0 },
  emptyList:   [],
  emptyPage:   { results: [], count: 0 },
};

/**
 * Register page.route() handlers for every Django API endpoint the dashboard
 * calls on mount.  A single catch-all fallback returns `[]` for anything else.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function mockDjangoApi(page) {
  await page.route('http://localhost:8000/api/**', async (route) => {
    const url = route.request().url();
    let body;

    if (url.includes('/accounts/profile'))           body = STUBS.profile;
    else if (url.includes('/accounts/notifications/unread-count')) body = STUBS.unreadCount;
    else if (url.includes('/accounts/notifications')) body = STUBS.emptyList;
    else if (url.includes('/emissions/summary'))     body = STUBS.summary;
    else if (url.includes('/emissions/entries'))     body = STUBS.emptyPage;
    else if (url.includes('/emissions/factors'))     body = STUBS.emptyList;
    else if (url.includes('/emissions/targets'))     body = STUBS.emptyList;
    else if (url.includes('/emissions/custom-requests')) body = STUBS.emptyList;
    else if (url.includes('/emissions/pending'))     body = STUBS.emptyList;
    else if (url.includes('/companies/facilities'))  body = STUBS.emptyList;
    else if (url.includes('/companies/memberships')) body = STUBS.emptyList;
    else                                             body = STUBS.emptyList; // safe default

    await route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify(body),
    });
  });
}

/**
 * Seed the browser with the auth state the app expects after a successful login:
 *   • `carbonless_auth=1` cookie  → lets middleware pass /dashboard
 *   • `_ca` localStorage item     → lets api.js attach Bearer token
 *
 * Call this AFTER navigating to any page on the same origin (addInitScript runs
 * before load, but cookies must be set via page.context().addCookies()).
 *
 * @param {import('@playwright/test').Page} page
 */
export async function seedAuth(page) {
  // Cookie — middleware reads this to decide whether to redirect /dashboard
  await page.context().addCookies([{
    name:    'carbonless_auth',
    value:   '1',
    domain:  'localhost',
    path:    '/',
    sameSite: 'Lax',
  }]);

  // localStorage token — api.js reads _ca via getToken()
  await page.addInitScript((token) => {
    localStorage.setItem('_ca', token);
  }, MOCK_TOKEN);
}
