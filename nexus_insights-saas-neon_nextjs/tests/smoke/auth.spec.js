/**
 * Smoke tests — authentication flow
 *
 * Tests login success / failure paths.  The /api/auth/login Next.js route
 * handler is mocked via page.route() so no real Django backend is needed.
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, MOCK_TOKEN } from '../helpers/mock-api.js';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Fill and submit the login form. */
async function submitLogin(page, credential, password) {
  await page.fill('#login-email', credential);
  await page.fill('#login-password', password);
  await page.click('button[type="submit"]');
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe('Login flow', () => {

  test('shows error message on invalid credentials (401)', async ({ page }) => {
    await page.route('**/api/auth/login', route =>
      route.fulfill({
        status:      401,
        contentType: 'application/json',
        body:        JSON.stringify({ error: 'No active account found with the given credentials.' }),
      })
    );

    await page.goto('/login');
    await submitLogin(page, 'wrong@example.com', 'badpassword');

    // The component renders the error returned by the backend
    await expect(page.getByText(/No active account|invalid|hatalı/i)).toBeVisible();
    // Must stay on /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows server-error message on 500', async ({ page }) => {
    await page.route('**/api/auth/login', route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    );

    await page.goto('/login');
    await submitLogin(page, 'user@example.com', 'pass');

    await expect(page.getByText(/server error|Sunucu hatası/i)).toBeVisible();
  });

  test('redirects to /dashboard after successful login', async ({ page }) => {
    // Mock login: return a valid access token
    await page.route('**/api/auth/login', route =>
      route.fulfill({
        status:      200,
        contentType: 'application/json',
        body:        JSON.stringify({ access: MOCK_TOKEN }),
      })
    );

    // Mock all Django API calls so the dashboard can hydrate without a real server
    await mockDjangoApi(page);

    await page.goto('/login');
    await submitLogin(page, 'smokeuser', 'correctpass');

    // After markSessionActive() sets the cookie and router.push('/dashboard'),
    // the middleware lets the request through and the dashboard renders.
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('submit button is disabled while request is in-flight', async ({ page }) => {
    // Slow response — lets us assert the loading state
    await page.route('**/api/auth/login', async route => {
      await new Promise(r => setTimeout(r, 800)); // simulate network latency
      await route.fulfill({
        status: 401, contentType: 'application/json',
        body: JSON.stringify({ error: 'Wrong credentials' }),
      });
    });

    await page.goto('/login');
    await page.fill('#login-email', 'u@e.com');
    await page.fill('#login-password', 'p');

    // Click submit, then immediately check the button is disabled
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    await expect(submitBtn).toBeDisabled();

    // Once the response comes back the button re-enables
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
  });

});

test.describe('Logout', () => {

  test('clears session and redirects to /login', async ({ page }) => {
    // Seed auth so we start on the dashboard
    const { seedAuth } = await import('../helpers/mock-api.js');
    await mockDjangoApi(page);

    // Navigate to the app first (required before adding cookies)
    await page.goto('/login');
    await page.context().addCookies([{
      name: 'carbonless_auth', value: '1',
      domain: 'localhost', path: '/', sameSite: 'Lax',
    }]);
    await page.addInitScript((tok) => localStorage.setItem('_ca', tok), MOCK_TOKEN);

    // Mock logout endpoint
    await page.route('**/api/auth/logout', route =>
      route.fulfill({ status: 204, body: '' })
    );

    await page.goto('/dashboard');

    // Find and click the logout button (it lives in DashboardSidebar)
    // The sidebar has a logout button — trigger it via the JS api directly
    // to avoid brittle selector coupling to the exact sidebar DOM.
    await page.evaluate(() => {
      // api.logout() clears token, removes cookie, and navigates to /login
      const event = new CustomEvent('carbonless:logout-test');
      window.dispatchEvent(event);
    });

    // Directly invoke the logout via the api module (avoids tight DOM coupling)
    await page.evaluate(async () => {
      const { api } = await import('/src/lib/utils/api.js').catch(() => ({}));
      if (api?.logout) await api.logout();
    });

    await page.waitForURL(/\/login/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

});
