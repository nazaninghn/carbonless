/**
 * Smoke test — Login page: the door handle is pressed down after a successful sign-in, then the app opens.
 *
 *  - only after the server accepts the sign-in; a wrong password shows the error and leaves the picture untouched
 *  - only the handle turns (about its spindle); the rest of the picture stays still
 *  - the redirect waits for the animation (~1 s); one request however often Login is pressed
 *  - reduced motion: no animation, straight on
 *  - desktop and phone
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, MOCK_TOKEN } from '../helpers/mock-api.js';

async function setup(page, { ok = true, size = { width: 1440, height: 900 }, reduce = false } = {}) {
  const calls = { n: 0 };
  await page.setViewportSize(size);
  await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await page.route('**/api/auth/login', async route => {
    calls.n++;
    await new Promise(r => setTimeout(r, 300));
    await route.fulfill(ok
      ? { status: 200, contentType: 'application/json', body: JSON.stringify({ access: MOCK_TOKEN }) }
      : { status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'No active account found with the given credentials' }) });
  });
  await mockDjangoApi(page);
  await page.goto('/login');
  await expect(page.locator('#login-email')).toBeVisible();
  await page.fill('#login-email', 'smokeuser');
  await page.fill('#login-password', 'pw');
  await page.locator('[data-testid="login-art-box"]').filter({ visible: true }).scrollIntoViewIfNeeded();
  return calls;
}

/* Watch the page from the click on: when the door opens, the handle's angle part-way, and when the page leaves /login. */
async function watch(page) {
  await page.evaluate(() => {
    const t0 = performance.now(); const log = window.__door = { open: null, angles: [] };
    const tick = () => {
      const box = [...document.querySelectorAll('[data-testid="login-art-box"]')].find(el => el.getClientRects().length);
      if (box?.dataset.door === 'open') {
        if (log.open === null) log.open = performance.now() - t0;
        const m = new DOMMatrix(getComputedStyle(box.querySelector('.login-door-handle')).transform);
        log.angles.push(Math.atan2(m.b, m.a) * 180 / Math.PI);
        log.whole = getComputedStyle(box.querySelector('.login-art-whole')).opacity;
        log.base = getComputedStyle(box.querySelector('[data-door-layer="base"]')).transform;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // when the redirect starts (not when the next page has arrived, which on a dev server includes compiling it)
    window.addEventListener('beforeunload', () =>sessionStorage.setItem('__door', JSON.stringify({ ...log, left: performance.now() - t0 })));
  });
}

for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`${size.width}: successful sign-in turns the handle, then opens the app`, async ({ page }) => {
    const calls = await setup(page, { size });
    await watch(page);
    await page.click('form button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    const log = JSON.parse(await page.evaluate(() => sessionStorage.getItem('__door')));
    expect(calls.n).toBe(1);
    expect(log.open).not.toBeNull();                                        // the door opened...
    expect(log.open).toBeGreaterThanOrEqual(250);                           // ...only after the server answered
    expect(log.left - log.open).toBeGreaterThanOrEqual(900);               // the redirect waited for the animation
    expect(log.left - log.open).toBeLessThan(1600);
    expect(Math.max(...log.angles)).toBeGreaterThan(27);                    // the handle turned down (clockwise) about 30°
    expect(Math.min(...log.angles)).toBeGreaterThan(-3);
    expect(log.whole).toBe('0');                                            // the layers stand in for the picture
    expect(log.base).toBe('none');                                          // and the rest of the picture does not move
  });
}

test('wrong password: the error, no animation, the picture untouched', async ({ page }) => {
  await setup(page, { ok: false });
  await page.click('form button[type="submit"]');
  await expect(page.getByText(/No active account/)).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/login/);
  const g = await page.evaluate(() => {
    const box = [...document.querySelectorAll('[data-testid="login-art-box"]')].find(el => el.getClientRects().length);
    return { door: box.dataset.door ?? null, handle: getComputedStyle(box.querySelector('.login-door-handle')).transform, whole: getComputedStyle(box.querySelector('.login-art-whole')).opacity, layers: getComputedStyle(box.querySelector('.login-door')).opacity };
  });
  expect(g).toEqual({ door: null, handle: 'none', whole: '1', layers: '0' });
  await expect(page.locator('form button[type="submit"]')).toBeEnabled();  // free to try again
});

test('pressing Login again while signing in or while the door opens sends one request', async ({ page }) => {
  const calls = await setup(page);
  const btn = page.locator('form button[type="submit"]');
  await btn.click();
  for (let i = 0; i < 3; i++) await btn.click({ force: true, noWaitAfter: true }).catch(() => {});
  await page.locator('#login-password').press('Enter').catch(() => {});
  await expect(btn).toBeDisabled();
  await page.waitForTimeout(700);                                           // the door is opening now
  await page.locator('#login-password').press('Enter').catch(() => {});
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  expect(calls.n).toBe(1);
});

test('reduced motion: no animation, straight to the app', async ({ page }) => {
  const calls = await setup(page, { reduce: true });
  await watch(page);
  await page.click('form button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  const log = JSON.parse(await page.evaluate(() => sessionStorage.getItem('__door')));
  expect(calls.n).toBe(1);
  expect(log.open).toBeNull();
  expect(log.left).toBeLessThan(900);
});

/* -- Google sign-in --
   Real Google OAuth needs a Google account and its popup, so Google's script (accounts.google.com/gsi/client) is replaced
   by a stand-in: renderButton draws a "Continue with Google" button, and pressing it does what Google does once the user
   picks an account (calls the page's callback with a credential), or nothing at all when `cancel` is set (the user closed
   Google's window). /api/auth/google is mocked like /api/auth/login above. */
async function setupGoogle(page, { status = 200, cancel = false, reduce = false, size = { width: 1440, height: 900 } } = {}) {
  const calls = { google: 0, login: 0 };
  await page.setViewportSize(size);
  await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await page.route('https://accounts.google.com/gsi/client**', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: `
    window.google = { accounts: { id: {
      initialize(cfg) { window.__gsiCallback = cfg.callback; },
      renderButton(el) {
        el.innerHTML = '<button type="button" data-testid="gsi-button">Continue with Google</button>';
        el.firstChild.onclick = () => { if (!${cancel}) window.__gsiCallback({ credential: 'test-google-credential', select_by: 'btn' }); };
      },
    } } };` }));
  await page.route('**/api/auth/google', async route => {
    calls.google++;
    await new Promise(r => setTimeout(r, 300));
    await route.fulfill(status === 200
      ? { status: 200, contentType: 'application/json', body: JSON.stringify({ access: MOCK_TOKEN }) }
      : { status, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid Google token' }) });
  });
  await page.route('**/api/auth/login', route => { calls.login++; return route.fulfill({ status: 500, body: '{}' }); });
  await mockDjangoApi(page);
  const gsi = page.waitForRequest(/accounts\.google\.com\/gsi\/client/, { timeout: 8000 }).catch(() => null);
  await page.goto('/login');
  test.skip(!(await gsi), 'The Google button is only shown when NEXT_PUBLIC_GOOGLE_CLIENT_ID is set for the dev server.');
  await expect(page.getByTestId('gsi-button')).toBeVisible();
  await page.locator('[data-testid="login-art-box"]').filter({ visible: true }).scrollIntoViewIfNeeded();
  return calls;
}

const doorState = page => page.evaluate(() => {
  const box = [...document.querySelectorAll('[data-testid="login-art-box"]')].find(el => el.getClientRects().length);
  return { door: box.dataset.door ?? null, handle: getComputedStyle(box.querySelector('.login-door-handle')).transform, whole: getComputedStyle(box.querySelector('.login-art-whole')).opacity };
});

for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`Google ${size.width}: successful sign-in turns the same handle, then opens the app`, async ({ page }) => {
    const calls = await setupGoogle(page, { size });
    await watch(page);
    await page.getByTestId('gsi-button').click();
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    const log = JSON.parse(await page.evaluate(() => sessionStorage.getItem('__door')));
    expect(calls).toEqual({ google: 1, login: 0 });
    expect(log.open).toBeGreaterThanOrEqual(250);                           // not while Google sign-in was pending
    expect(log.left - log.open).toBeGreaterThanOrEqual(900);
    expect(log.left - log.open).toBeLessThan(1600);
    expect(Math.max(...log.angles)).toBeGreaterThan(27);
    expect(log.whole).toBe('0');
    expect(log.base).toBe('none');
  });
}

test('Google cancelled: nothing happens, the door stays shut', async ({ page }) => {
  const calls = await setupGoogle(page, { cancel: true });
  await page.getByTestId('gsi-button').click();
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/login/);
  expect(calls.google).toBe(0);
  expect(await doorState(page)).toEqual({ door: null, handle: 'none', whole: '1' });
  await expect(page.locator('form button[type="submit"]')).toBeEnabled();
});

for (const status of [401, 500]) {
  test(`Google failed (${status}): the same error as before, the door stays shut`, async ({ page }) => {
    await setupGoogle(page, { status });
    await page.getByTestId('gsi-button').click();
    await expect(page.getByText('Invalid Google token')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/login/);
    expect(await doorState(page)).toEqual({ door: null, handle: 'none', whole: '1' });
    await expect(page.locator('form button[type="submit"]')).toBeEnabled();  // free to try again
  });
}

test('Google pressed again, or Login pressed, while signing in or while the door opens: one request, one redirect', async ({ page }) => {
  const calls = await setupGoogle(page);
  let redirects = 0;   // page loads of the app (the dashboard may then update its own URL in place; that is not a redirect)
  page.on('request', r => { if (r.isNavigationRequest() && r.frame() === page.mainFrame() && /\/dashboard/.test(r.url())) redirects++; });
  const g = page.getByTestId('gsi-button');
  await g.click();
  for (let i = 0; i < 3; i++) await g.click({ noWaitAfter: true });
  await page.waitForTimeout(700);                                           // the door is opening now
  await g.click({ noWaitAfter: true }).catch(() => {});
  await page.fill('#login-email', 'u').catch(() => {}); await page.fill('#login-password', 'p').catch(() => {});
  await page.locator('#login-password').press('Enter').catch(() => {});
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  await page.waitForTimeout(800);
  expect(calls).toEqual({ google: 1, login: 0 });
  expect(redirects).toBe(1);
});

test('Google with reduced motion: no animation, straight to the app', async ({ page }) => {
  const calls = await setupGoogle(page, { reduce: true });
  await watch(page);
  await page.getByTestId('gsi-button').click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  const log = JSON.parse(await page.evaluate(() => sessionStorage.getItem('__door')));
  expect(calls.google).toBe(1);
  expect(log.open).toBeNull();
  expect(log.left).toBeLessThan(900);
});

test('Google: if the picture layers cannot load, sign-in still goes straight on', async ({ page }) => {
  await page.route(/login-door-(base|handle)\.webp/, route => route.abort());
  const calls = await setupGoogle(page);
  await watch(page);
  await page.getByTestId('gsi-button').click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  const log = JSON.parse(await page.evaluate(() => sessionStorage.getItem('__door')));
  expect(calls.google).toBe(1);
  expect(log.open).toBeNull();                                              // no half-drawn door
  expect(log.left).toBeLessThan(1500);                                      // and no hang (at most the 0.8 s wait for the layers)
});
