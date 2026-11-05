/**
 * Smoke test — the 30-minute inactivity timeout, as the browser lives it (the server's half is tested in
 * carbonless_backend/accounts/test_session_idle.py).
 *
 * Time is simulated with Playwright's clock (shared by all tabs of the context), so "30 minutes" takes seconds. The backend
 * and the Next.js refresh/logout routes are mocked; what is checked is what the browser sends, shows and clears.
 *
 *   1. 30 minutes of inactivity -> signed out, credentials cleared, login page says why
 *   2. working past 30 minutes -> stays signed in; the server is told about the activity
 *   3. idle in one tab, active in another -> both stay signed in
 *   4. mouse movement, scrolling and background polling are not activity
 *   5. a reload does not revive an expired session
 *   6. an automatic refresh (after an expired access token) reports no activity
 *   7. an answer typed but not submitted: warned before the end, and the login page says it was not saved
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, MOCK_TOKEN } from '../helpers/mock-api.js';

test.setTimeout(90_000);

const START = new Date('2026-03-02T09:00:00');
const MIN = '01:00';
const minutes = (n) => `${String(n).padStart(2, '0')}:00`;
const jump = async (page, time) => { await page.clock.fastForward(time); await page.clock.runFor('00:02'); };

async function setup(context, { storedActivityMinutesAgo = null, told = false, clock = true } = {}) {
  await context.addCookies([
    { name: 'carbonless_auth', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax' },
    { name: 'carbonless_mode_chosen', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax' },
  ]);
  if (clock) await context.clock.install({ time: START });
  // sign in once per tab: after the redirect to the login page the token must stay cleared
  await context.addInitScript(([token, ago, told]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('_ca', token);
    if (ago != null) localStorage.setItem('carbonless_last_activity', String(Date.now() - ago * 60 * 1000));
    if (told) {            // the server already knows about the sign-in: no first extension
      localStorage.setItem('carbonless_last_activity', String(Date.now()));
      localStorage.setItem('carbonless_last_extend', String(Date.now()));
      localStorage.setItem('carbonless_last_reported', String(Date.now()));
    }
  }, [MOCK_TOKEN, storedActivityMinutesAgo, told]);
  await context.addInitScript(() => localStorage.setItem('language', 'en'));
  const calls = { refresh: [], logout: 0 };
  await context.route('**/api/auth/refresh', async (route) => {
    calls.refresh.push(route.request().headers()['x-user-activity'] ?? null);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access: `${MOCK_TOKEN}-${calls.refresh.length}` }) });
  });
  await context.route('**/api/auth/logout', async (route) => {
    calls.logout += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok' }) });
  });
  return calls;
}

async function openDashboard(context) {
  const page = await context.newPage();
  await mockDjangoApi(page);
  await page.goto('/dashboard?tab=dashboard');
  await expect(page.locator('#main-content')).toBeVisible();
  return page;
}

test.describe('inactivity timeout', () => {
  test('30 minutes without activity signs the user out, clears the credentials and says why', async ({ context }) => {
    const calls = await setup(context, { told: true });
    const page = await openDashboard(context);
    await jump(page, minutes(31));
    await expect(page).toHaveURL(/\/login\?reason=session_expired/, { timeout: 20_000 });
    expect(await page.evaluate(() => localStorage.getItem('_ca'))).toBeNull();
    expect(calls.logout).toBeGreaterThan(0);
    await expect(page.getByText(/ended after 30 minutes of inactivity/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/saved data is safe/)).toBeVisible();
    // no activity was ever reported to the server on the way: nothing extended the session
    expect(calls.refresh.filter(Boolean)).toEqual([]);
  });

  test('a user who keeps working stays signed in well past 30 minutes, and the server hears about the activity', async ({ context }) => {
    const calls = await setup(context);
    const page = await openDashboard(context);
    for (let i = 0; i < 6; i++) {                       // 90 minutes in total, a click every 15
      await jump(page, minutes(15));
      await page.mouse.click(300, 300);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    }
    await jump(page, '01:00');
    expect(await page.evaluate(() => localStorage.getItem('_ca'))).toBeTruthy();
    const reported = calls.refresh.filter(Boolean).map(Number);
    expect(reported.length).toBeGreaterThanOrEqual(5);   // told after each burst of activity
    expect(reported.every((n) => Number.isInteger(n) && n >= 0 && n <= 30 * 60)).toBe(true);
    // and then 31 quiet minutes end it
    await jump(page, minutes(31));
    await expect(page).toHaveURL(/\/login\?reason=session_expired/, { timeout: 20_000 });
  });

  test('idle in one tab but active in another: both stay signed in; both end together when everyone is idle', async ({ context }) => {
    await setup(context);
    const a = await openDashboard(context);
    const b = await openDashboard(context);
    for (let i = 0; i < 3; i++) {                       // 45 minutes: only tab B is used
      await jump(b, minutes(15));
      await b.bringToFront();
      await b.mouse.click(300, 300);
    }
    await expect(a).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    await expect(b).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    await jump(b, minutes(31));
    await expect(b).toHaveURL(/\/login\?reason=session_expired/, { timeout: 20_000 });
    await expect(a).toHaveURL(/\/login\?reason=session_expired/, { timeout: 20_000 });
  });

  test('mouse movement, scrolling and background polling are not activity', async ({ context }) => {
    await setup(context);
    const page = await openDashboard(context);
    for (let i = 0; i < 28; i++) {
      await jump(page, MIN);
      await page.mouse.move(100 + i * 5, 200 + i * 3);
      await page.mouse.wheel(0, 120);
    }
    await jump(page, minutes(3));
    await expect(page).toHaveURL(/\/login\?reason=session_expired/, { timeout: 20_000 });
  });

  test('reloading the page does not revive a session that has already expired', async ({ context }) => {
    await setup(context, { storedActivityMinutesAgo: 31 });
    const page = await context.newPage();
    await mockDjangoApi(page);
    await page.goto('/dashboard?tab=dashboard');
    await expect(page).toHaveURL(/\/login\?reason=session_expired/, { timeout: 20_000 });
    expect(await page.evaluate(() => localStorage.getItem('_ca'))).toBeNull();
    await page.reload();                                // and reloading the login page does not sign anyone in
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    expect(await page.evaluate(() => localStorage.getItem('_ca'))).toBeNull();
  });

  test('an automatic refresh after an expired access token reports no activity (it cannot extend the session)', async ({ context }) => {
    const calls = await setup(context, { told: true });
    const page = await context.newPage();
    let expiredOnce = false;
    await mockDjangoApi(page);
    await page.route('http://localhost:8000/api/accounts/profile/**', async (route) => {
      const auth = route.request().headers().authorization || '';
      if (!expiredOnce && auth.endsWith(MOCK_TOKEN)) {
        expiredOnce = true;
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'expired' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'smoke', first_name: 'Smoke' }) });
    });
    await page.goto('/dashboard?tab=dashboard');
    await expect.poll(() => calls.refresh.length).toBeGreaterThan(0);
    expect(calls.refresh[0]).toBeNull();                // no x-user-activity header
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });

  test('when the server refuses the refresh, the user lands on the login page with the expiry notice', async ({ context }) => {
    await setup(context);
    await context.route('**/api/auth/refresh', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Session expired' }) }));
    const page = await context.newPage();
    await mockDjangoApi(page);
    await page.route('http://localhost:8000/api/accounts/profile/**', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
    await page.goto('/dashboard?tab=dashboard');
    await expect(page).toHaveURL(/\/login\?reason=session_expired/, { timeout: 20_000 });
    expect(await page.evaluate(() => localStorage.getItem('_ca'))).toBeNull();
  });
});

test.describe('unsaved answers', () => {
  const report = { report_id: 1, title: 'Inventory A', status: 'in_progress', reporting_year: 2025, current_step: 'B2',
    progress: { percent: 10, completed: 9, total: 98 }, updated_at: '2026-01-01T00:00:00Z', created_by: null };
  const PHASE1 = { A1: { answer: 'Alpha' }, A2: { answer: 'x' }, A3: { answer: 'x' }, A4: { answer: '2025' }, A5: { answer: 'x' }, A6: { answer: 'x' }, A7: { answer: 'no' }, B1: { answer: 'NACE_A' } };

  test('an answer typed but not submitted is warned about before the session ends, and the login page says it was not saved', async ({ context }) => {
    await setup(context);
    const page = await context.newPage();
    await mockDjangoApi(page);
    const saved = [];
    await page.route('http://localhost:8000/api/questionnaire/**', async (route) => {
      const url = new URL(route.request().url());
      const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/api/questionnaire/') return json({ reports: [report] });
      if (/^\/api\/questionnaire\/1\/$/.test(url.pathname)) {
        return json({ ...report, answers: PHASE1, completed_steps: Object.keys(PHASE1), advisor_rejected: [], advisor_pending: 0, pending_questions: [] });
      }
      if (route.request().method() !== 'GET') saved.push(url.pathname);
      return json({});
    });
    await page.goto('/dashboard?tab=questionnaire');
    await page.getByRole('button', { name: /Continue/ }).first().click();
    const field = page.locator('textarea, input[type="text"]').first();
    await field.fill('We make things');                  // typed, never submitted
    await jump(page, minutes(28));
    await jump(page, '00:30');
    const warning = page.getByTestId('session-idle-warning');
    await expect(warning).toBeVisible();
    await expect(page.getByTestId('session-idle-unsaved')).toContainText(/has not been submitted/);
    await jump(page, minutes(3));
    await expect(page).toHaveURL(/\/login\?reason=session_expired/, { timeout: 20_000 });
    await expect(page.getByTestId('session-unsaved-note')).toContainText(/not saved/, { timeout: 20_000 });
    expect(saved).toEqual([]);                           // nothing was claimed saved: nothing was sent
  });

  test('"Stay signed in" in the warning keeps the session going', async ({ context }) => {
    await setup(context);
    const page = await openDashboard(context);
    await jump(page, minutes(28));
    await jump(page, '00:30');
    await expect(page.getByTestId('session-idle-warning')).toBeVisible();
    await expect(page.getByTestId('session-idle-unsaved')).toHaveCount(0);
    await page.getByTestId('session-stay').click();
    await expect(page.getByTestId('session-idle-warning')).toHaveCount(0);
    await jump(page, minutes(10));
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });
});

test.describe('the server ends the session', () => {
  test('a refresh the server answers with "session_expired" signs the user out at once', async ({ context }) => {
    await setup(context);
    await context.route('**/api/auth/refresh', (route) => route.fulfill({
      status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Session expired', code: 'session_expired' }),
    }));
    const page = await openDashboard(context);
    await jump(page, '02:00');
    await page.mouse.click(300, 300);                    // activity the server has not heard about: the guard tells it ...
    await jump(page, '01:00');                           // ... at its next check, and the server answers "session_expired"
    await expect(page).toHaveURL(/\/login\?reason=session_expired/, { timeout: 20_000 });
    expect(await page.evaluate(() => localStorage.getItem('_ca'))).toBeNull();
  });

  test('a refusal without that code (for example no refresh cookie) does not sign anyone out by itself', async ({ context }) => {
    await setup(context);
    await context.route('**/api/auth/refresh', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'No refresh token' }) }));
    const page = await openDashboard(context);
    await jump(page, '02:00');
    await page.mouse.click(300, 300);
    await jump(page, '03:00');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });
});

/**
 * Refresh reliability. A refresh rotates the refresh token, so an answer that never arrives must not cost the user their
 * session, and a transient failure must not log anyone out. Real timers here: the retries wait 1 s and 3 s.
 *   - an interrupted request is repeated as the SAME attempt (same attempt id) and the user stays signed in
 *   - no answer at all after the retries: still signed in (the next check tries again)
 *   - a burst of 401s in one tab, and two tabs at once, produce ONE refresh
 */
test.describe('refresh reliability', () => {
  /** every backend call made with the original token is refused (as an expired one), as in a real expiry */
  async function expireOriginalToken(page) {
    await page.route('http://localhost:8000/api/**', async (route) => {
      const auth = route.request().headers().authorization || '';
      if (auth.endsWith(MOCK_TOKEN)) {
        return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'expired' }) });
      }
      return route.fallback();
    });
  }
  const refreshReply = (access) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ access }) });

  test('an interrupted refresh is repeated as the same attempt and the user stays signed in', async ({ context }) => {
    await setup(context, { clock: false });
    const attempts = [];
    await context.route('**/api/auth/refresh', async (route) => {
      attempts.push(route.request().headers()['x-refresh-attempt'] || null);
      if (attempts.length === 1) return route.abort('connectionreset');       // the answer is lost
      return route.fulfill(refreshReply(`${MOCK_TOKEN}-new`));
    });
    const page = await context.newPage();
    await mockDjangoApi(page);
    await expireOriginalToken(page);
    await page.goto('/dashboard?tab=dashboard');
    await expect.poll(() => attempts.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    expect(attempts[0]).toBeTruthy();
    expect(new Set(attempts).size).toBe(1);                                   // the SAME attempt id every time
    await expect.poll(() => page.evaluate(() => localStorage.getItem('_ca')), { timeout: 15_000 }).toBe(`${MOCK_TOKEN}-new`);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  });

  test('a new refresh is a new attempt (the id is not reused between attempts)', async ({ context }) => {
    await setup(context, { clock: false });
    const ids = [];
    await context.route('**/api/auth/refresh', async (route) => {
      ids.push(route.request().headers()['x-refresh-attempt']);
      return route.fulfill(refreshReply(`${MOCK_TOKEN}-${ids.length}`));
    });
    const page = await context.newPage();
    await mockDjangoApi(page);
    await page.goto('/dashboard?tab=dashboard');
    for (let i = 0; i < 2; i++) {
      await page.evaluate((t) => localStorage.setItem('_ca', t), MOCK_TOKEN);   // the token "expires" again
      await page.reload();
      await expireOriginalToken(page);
      await page.reload();
    }
    await expect.poll(() => ids.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('no answer at all after the retries does not sign the user out', async ({ context }) => {
    await setup(context, { clock: false });
    const attempts = [];
    await context.route('**/api/auth/refresh', async (route) => {
      attempts.push(route.request().headers()['x-refresh-attempt'] || null);
      return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Auth server unavailable' }) });
    });
    const page = await context.newPage();
    await mockDjangoApi(page);
    await expireOriginalToken(page);
    await page.goto('/dashboard?tab=dashboard');
    await expect.poll(() => attempts.length, { timeout: 15_000 }).toBe(3);   // the first try and two repeats
    expect(new Set(attempts).size).toBe(1);
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    expect(await page.evaluate(() => localStorage.getItem('_ca'))).toBe(MOCK_TOKEN);   // still signed in, token untouched
  });

  test('a burst of 401s in one tab makes one refresh', async ({ context }) => {
    await setup(context, { clock: false });
    let count = 0;
    await context.route('**/api/auth/refresh', async (route) => {
      count += 1;
      await new Promise((r) => setTimeout(r, 400));
      return route.fulfill(refreshReply(`${MOCK_TOKEN}-new`));
    });
    const page = await context.newPage();
    await mockDjangoApi(page);
    await expireOriginalToken(page);
    await page.goto('/dashboard?tab=dashboard');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('_ca')), { timeout: 15_000 }).toBe(`${MOCK_TOKEN}-new`);
    await page.waitForTimeout(800);
    expect(count).toBe(1);
  });

  test('two tabs expiring at the same moment make one refresh between them', async ({ context }) => {
    await setup(context, { clock: false });
    let count = 0;
    await context.route('**/api/auth/refresh', async (route) => {
      count += 1;
      await new Promise((r) => setTimeout(r, 900));
      return route.fulfill(refreshReply(`${MOCK_TOKEN}-new`));
    });
    const a = await context.newPage();
    const b = await context.newPage();
    for (const p of [a, b]) { await mockDjangoApi(p); await expireOriginalToken(p); }
    await Promise.all([a.goto('/dashboard?tab=dashboard'), b.goto('/dashboard?tab=dashboard')]);
    for (const p of [a, b]) {
      await expect.poll(() => p.evaluate(() => localStorage.getItem('_ca')), { timeout: 20_000 }).toBe(`${MOCK_TOKEN}-new`);
      await expect(p).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    }
    await a.waitForTimeout(800);
    expect(count).toBe(1);
  });
});
