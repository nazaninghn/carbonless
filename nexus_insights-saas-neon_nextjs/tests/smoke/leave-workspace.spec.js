/**
 * Smoke test — browser Back inside the signed-in workspace asks "Do you want to leave?" (Stay / Log Out).
 *
 *  - Dashboard and AI Analyzer (both /dashboard): Back opens the dialog and the user stays on the page
 *  - Stay closes it and keeps the page (and the AI Analyzer view); Back again asks again, one dialog at a time
 *  - Log Out runs the normal logout (POST /api/auth/logout, token and session cookie cleared) and lands on Login;
 *    the dialog can't be dismissed while it runs; afterwards /dashboard needs signing in again
 *  - switching between Dashboard and AI Analyzer never asks; Forward and a reload don't ask or sign out
 *  - English and Turkish; keyboard (focus on Stay, Tab stays inside, Escape = Stay)
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

const EN = {
  title: 'Do you want to leave?',
  message: 'Are you sure you want to leave your Carbonless workspace? You will remain signed in unless you choose to log out.',
  stay: 'Stay', logout: 'Log Out',
};
const TR = {
  title: 'Ayrılmak istiyor musunuz?',
  message: 'Carbonless çalışma alanından ayrılmak istediğinizden emin misiniz? Çıkış yapmayı seçmediğiniz sürece hesabınız açık kalacaktır.',
  stay: 'Kal', logout: 'Çıkış Yap',
};

const dialog = page => page.getByTestId('leave-workspace-dialog');

/* Signed in, arriving on /dashboard from another page (as after signing in), so Back has somewhere to go. */
async function setup(page, { lang = 'en', size = { width: 1440, height: 900 }, logoutDelay = 0 } = {}) {
  await page.setViewportSize(size);
  await mockDjangoApi(page);
  const calls = { logout: 0 };
  await page.route('**/api/auth/logout', async route => {
    calls.logout++;
    if (logoutDelay) await new Promise(r => setTimeout(r, logoutDelay));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await seedAuth(page);
  await page.addInitScript(l => { localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1'); }, lang);
  await page.goto('/');
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: /Ask Carbon AI|Carbon AI'ya sorun/ })).toBeVisible({ timeout: 20_000 });
  return calls;
}
const back = page => page.evaluate(() => history.back());
const forward = page => page.evaluate(() => history.forward());
const histLen = page => page.evaluate(() => history.length);

test('Dashboard: Back asks; Stay keeps the page; Back again asks again (one dialog, no loop)', async ({ page }) => {
  const calls = await setup(page);
  const len = await histLen(page);
  await back(page);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole('heading')).toHaveText(EN.title);
  await expect(dialog(page)).toContainText(EN.message);
  await expect(page).toHaveURL(/\/dashboard$/);
  await dialog(page).getByRole('button', { name: EN.stay }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('button', { name: /Ask Carbon AI/ })).toBeVisible();   // still the dashboard
  for (let i = 0; i < 3; i++) {
    await back(page);
    await expect(dialog(page)).toBeVisible();
    await expect(page.locator('[data-testid="leave-workspace-dialog"]')).toHaveCount(1);
    await dialog(page).getByRole('button', { name: EN.stay }).click();
    await expect(dialog(page)).toBeHidden();
  }
  expect(await histLen(page)).toBe(len);                                    // the history does not grow
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(calls.logout).toBe(0);                                             // only Log Out signs out
  expect((await page.context().cookies()).some(c => c.name === 'carbonless_auth')).toBe(true);
});

test('AI Analyzer: switching to and from it never asks; Back on it asks and Stay keeps the AI view', async ({ page }) => {
  await setup(page);
  const len = await histLen(page);
  await page.getByRole('button', { name: /^AI Analyzer$/ }).first().click();
  await expect(page.getByText('Carbon Inventory', { exact: true }).first()).toBeVisible();
  await page.waitForTimeout(500);
  await expect(dialog(page)).toHaveCount(0);
  expect(await histLen(page)).toBe(len);                                    // not a navigation
  await back(page);
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('button', { name: EN.stay }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.locator('.fixed.inset-0.z-\\[85\\]')).toBeVisible();   // still the AI Analyzer view
  // and back to the Dashboard: no question
  await page.locator('.fixed.inset-0.z-\\[85\\]').getByRole('button', { name: /^Dashboard$/ }).click();
  await page.waitForTimeout(500);
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator('.fixed.inset-0.z-\\[85\\]')).toHaveCount(0);
});

test('Log Out: the normal logout, then the Login page; not dismissable meanwhile; /dashboard needs signing in again', async ({ page }) => {
  const calls = await setup(page, { logoutDelay: 900 });
  // the stored token as the dashboard unloads (the test helper seeds it again on every new page, Login included)
  await page.evaluate(() => window.addEventListener('pagehide', () => sessionStorage.setItem('caAtLeave', String(localStorage.getItem('_ca')))));
  await back(page);
  await dialog(page).getByRole('button', { name: EN.logout }).click();
  // while the logout request runs: busy, can't be dismissed
  await expect(dialog(page)).toHaveAttribute('aria-busy', 'true');
  await expect(dialog(page).getByRole('button', { name: EN.stay })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeVisible();
  await page.waitForURL(/\/login$/, { timeout: 10_000 });
  expect(calls.logout).toBe(1);                                             // the real logout endpoint, once
  expect((await page.context().cookies()).some(c => c.name === 'carbonless_auth')).toBe(false);
  expect(await page.evaluate(() => sessionStorage.getItem('caAtLeave'))).toBe('null');   // the token was cleared
  // the session is over: the workspace sends back to Login
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('Forward and reload: no question, still signed in, and Back still asks (once)', async ({ page }) => {
  const calls = await setup(page);
  const len = await histLen(page);
  await forward(page);                                                      // nothing ahead: stays
  await page.waitForTimeout(400);
  await expect(dialog(page)).toHaveCount(0);
  await back(page);
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('button', { name: EN.stay }).click();
  await forward(page);
  await page.waitForTimeout(400);
  await expect(dialog(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/dashboard$/);
  // reload
  await page.reload();
  await expect(page.getByRole('button', { name: /Ask Carbon AI/ })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(400);
  await expect(dialog(page)).toHaveCount(0);
  expect(await histLen(page)).toBe(len);                                    // the guard is not added twice
  expect(calls.logout).toBe(0);
  expect((await page.context().cookies()).some(c => c.name === 'carbonless_auth')).toBe(true);
  await back(page);
  await expect(dialog(page)).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('direct URL: signed in it opens with no question; signed out it goes to Login', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockDjangoApi(page);
  await seedAuth(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: /Ask Carbon AI/ })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(400);
  await expect(dialog(page)).toHaveCount(0);
  const fresh = await browser.newPage();
  await fresh.goto('/dashboard');
  await expect(fresh).toHaveURL(/\/login/);
  await fresh.close();
});

test('Turkish', async ({ page }) => {
  await setup(page, { lang: 'tr' });
  await back(page);
  await expect(dialog(page).getByRole('heading')).toHaveText(TR.title);
  await expect(dialog(page)).toContainText(TR.message);
  await expect(dialog(page).getByRole('button', { name: TR.stay })).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: TR.logout })).toBeVisible();
  await dialog(page).getByRole('button', { name: TR.stay }).click();
  await expect(dialog(page)).toBeHidden();
});

test('keyboard: focus starts on Stay, Tab stays in the dialog, Escape stays', async ({ page }) => {
  await setup(page);
  await back(page);
  await expect(dialog(page).getByRole('button', { name: EN.stay })).toBeFocused();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog(page).evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('phone: the dialog fits', async ({ page }) => {
  await setup(page, { size: { width: 360, height: 740 } });
  await back(page);
  const box = await dialog(page).locator('h3').locator('xpath=ancestor::div[contains(@class,"max-w-sm")]').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(360);
  await expect(dialog(page).getByRole('button', { name: EN.logout })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

/* -- Review: history, state, failures, the real logout route -- */

test('history: the dashboard adds a fixed two guard entries (React Strict Mode included), and rapid Backs open one dialog', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockDjangoApi(page);
  await seedAuth(page);
  await page.goto('/');
  const before = await histLen(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: /Ask Carbon AI/ })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(300);
  expect(await histLen(page)).toBe(before + 3);                             // the page + its two guards, no more
  await page.evaluate(() => { history.back(); setTimeout(() => history.back(), 30); setTimeout(() => history.back(), 60); });
  await page.waitForTimeout(800);
  await expect(page.locator('[data-testid="leave-workspace-dialog"]')).toHaveCount(1);
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await histLen(page)).toBe(before + 3);
});

test('a "?tab=" link: Back then Stay keeps the clean URL (the query does not come back)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockDjangoApi(page);
  await seedAuth(page);
  await page.goto('/');
  await page.goto('/dashboard?tab=emissions');
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });           // the page drops the query
  await page.waitForTimeout(300);
  await back(page);
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('button', { name: EN.stay }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await page.evaluate(() => location.search)).toBe('');
});

test('Stay keeps the exact state: the section, its scroll position and an open AI chat', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /^Emissions$/ }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Ask Carbon AI/ }).click();
  await page.waitForTimeout(400);
  await page.evaluate(() => { const m = document.getElementById('main-content'); m.scrollTop = 200; });
  const before = await page.evaluate(() => ({
    tab: localStorage.getItem('carbonless_active_tab'), scroll: document.getElementById('main-content').scrollTop,
    chat: document.querySelector('[data-testid="ai-assistant-panel"]')?.dataset.open,
  }));
  expect(before.tab).toBe('emissions');
  await back(page);
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('button', { name: EN.stay }).click();
  await expect(dialog(page)).toBeHidden();
  const after = await page.evaluate(() => ({
    tab: localStorage.getItem('carbonless_active_tab'), scroll: document.getElementById('main-content').scrollTop,
    chat: document.querySelector('[data-testid="ai-assistant-panel"]')?.dataset.open,
  }));
  expect(after).toEqual(before);
});

test('Escape on the dialog only closes the dialog: an AI chat open behind it stays open', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /Ask Carbon AI/ }).click();
  await expect(page.getByTestId('ai-assistant-panel')).toHaveAttribute('data-open', 'true');
  await back(page);
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByTestId('ai-assistant-panel')).toHaveAttribute('data-open', 'true');
  // and Escape still closes the chat itself once the dialog is gone
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('ai-assistant-panel')).toHaveAttribute('data-open', 'false');
});

for (const failure of ['server error', 'no connection']) {
  test(`Log Out fails (${failure}): no redirect, still signed in, an error, and a retry works`, async ({ page }) => {
    await setup(page);
    let attempt = 0;
    await page.route('**/api/auth/logout', route => {
      attempt++;
      if (attempt === 1) return failure === 'server error' ? route.fulfill({ status: 500, body: '{}' }) : route.abort('internetdisconnected');
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' });
    });
    await back(page);
    await dialog(page).getByRole('button', { name: EN.logout }).click();
    await expect(page.getByTestId('leave-workspace-error')).toBeVisible();
    await expect(page.getByTestId('leave-workspace-error')).toContainText("Couldn't log out. You are still signed in.");
    await page.waitForTimeout(600);
    await expect(page).toHaveURL(/\/dashboard$/);                            // not sent to Login
    expect((await page.context().cookies()).some(c => c.name === 'carbonless_auth')).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('_ca'))).not.toBeNull();
    await expect(dialog(page)).not.toHaveAttribute('aria-busy', 'true');
    await expect(dialog(page).getByRole('button', { name: EN.stay })).toBeEnabled();
    await expect(dialog(page).getByRole('button', { name: EN.stay })).toBeFocused();   // keyboard users can carry on
    // the dashboard still works behind it
    await dialog(page).getByRole('button', { name: EN.stay }).click();
    await expect(page.getByRole('button', { name: /Ask Carbon AI/ })).toBeVisible();
    // try again: this time it works
    await back(page);
    await expect(page.getByTestId('leave-workspace-error')).toHaveCount(0);   // a fresh dialog, no stale error
    await dialog(page).getByRole('button', { name: EN.logout }).click();
    await page.waitForURL(/\/login$/, { timeout: 10_000 });
    expect(attempt).toBe(2);
  });
}

test('Turkish failure message', async ({ page }) => {
  await setup(page, { lang: 'tr' });
  await page.route('**/api/auth/logout', route => route.fulfill({ status: 500, body: '{}' }));
  await back(page);
  await dialog(page).getByRole('button', { name: TR.logout }).click();
  await expect(page.getByTestId('leave-workspace-error')).toContainText('Çıkış yapılamadı. Hesabınız hâlâ açık.');
});

test('the real logout route: the httpOnly refresh cookie and the session cookie are gone afterwards', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockDjangoApi(page);
  await seedAuth(page);
  await page.context().addCookies([{ name: '_carbonless_refresh', value: 'test-refresh-token', domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Strict' }]);
  await page.goto('/');
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: /Ask Carbon AI/ })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(300);
  // /api/auth/logout is NOT mocked here: the app's own route answers (and deletes the refresh cookie)
  await back(page);
  await dialog(page).getByRole('button', { name: EN.logout }).click();
  await page.waitForURL(/\/login$/, { timeout: 40_000 });
  const names = (await page.context().cookies()).map(c => c.name);
  expect(names).not.toContain('_carbonless_refresh');
  expect(names).not.toContain('carbonless_auth');
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);                                  // the middleware sees no session
});
