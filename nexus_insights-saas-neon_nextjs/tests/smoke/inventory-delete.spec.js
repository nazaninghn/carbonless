/**
 * Smoke test — deleting an inventory refreshes the dashboard
 *
 * The dashboard keeps its own copy of the totals (useDashboardData), which
 * reloads only on a year change or a `carbonless:emissions-updated` event.
 * Deleting an inventory removes its emission entries, so InventoryLibrary must
 * send that event — with a source other than 'inventory', which would move the
 * dashboard to the inventory's year.
 *
 * The Django backend is mocked (see helpers/mock-api.js); nothing real is deleted.
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

const DRAFT = {
  report_id: 41, title: 'Draft 2024', status: 'draft', reporting_year: 2024,
  progress: { percent: 0 }, updated_at: '2026-01-01T00:00:00Z', created_by: null,
};

/** Mock the inventory list/delete on top of the shared API mock; count summary loads. */
async function mockInventoryApi(page) {
  const seen = { summaryYears: [], deletes: 0, reports: [DRAFT] };
  await page.route('http://localhost:8000/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/api/emissions/summary/') {
      seen.summaryYears.push(url.searchParams.get('year'));
    } else if (url.pathname === '/api/questionnaire/' && req.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json',
                             body: JSON.stringify({ reports: seen.reports }) });
    } else if (url.pathname === `/api/questionnaire/${DRAFT.report_id}/` && req.method() === 'DELETE') {
      seen.deletes += 1;
      seen.reports = [];
      return route.fulfill({ status: 200, contentType: 'application/json',
                             body: JSON.stringify({ deleted_entries: 3 }) });
    }
    return route.fallback();   // everything else: the shared mock
  });
  return seen;
}

test.beforeEach(async ({ page }) => {
  await mockDjangoApi(page);
  await seedAuth(page);
  // Middleware sends a user who has not picked a startup mode to /dashboard/select.
  await page.context().addCookies([{
    name: 'carbonless_mode_chosen', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax',
  }]);
});

test('deleting an inventory dispatches emissions-updated with source "inventory-deleted"', async ({ page }) => {
  await mockInventoryApi(page);
  await page.goto('/dashboard?tab=questionnaire');
  await page.evaluate(() => {
    window.__updatedEvents = [];
    window.addEventListener('carbonless:emissions-updated', (e) => window.__updatedEvents.push(e.detail));
  });

  await page.getByRole('button', { name: /^(Delete|Sil)$/ }).first().click();
  await page.getByRole('button', { name: /^(Yes|Evet)$/ }).click();

  await expect.poll(() => page.evaluate(() => window.__updatedEvents)).toEqual([{ source: 'inventory-deleted' }]);
});

test('the dashboard reloads after a delete, on the same year, without a page reload', async ({ page }) => {
  const seen = await mockInventoryApi(page);
  await page.goto('/dashboard?tab=questionnaire');
  await expect(page.getByRole('button', { name: /^(Delete|Sil)$/ }).first()).toBeVisible();
  await page.evaluate(() => { window.__sameDocument = true; });   // lost on a full reload
  await expect.poll(() => seen.summaryYears.length).toBeGreaterThan(0);
  const before = seen.summaryYears.length;
  const yearBefore = seen.summaryYears.at(-1);

  await page.getByRole('button', { name: /^(Delete|Sil)$/ }).first().click();
  await page.getByRole('button', { name: /^(Yes|Evet)$/ }).click();

  // The hook waits 600 ms to fold a run of events into one reload.
  await expect.poll(() => seen.summaryYears.length, { timeout: 8_000 }).toBe(before + 1);
  expect(seen.deletes).toBe(1);
  expect(seen.summaryYears.at(-1)).toBe(yearBefore);        // the selected year did not move

  // Back on the Dashboard tab: no further load is needed, and the page was not reloaded.
  await page.getByRole('button', { name: /^(Dashboard|Kontrol Paneli)/ }).first().click();
  await page.waitForTimeout(1_000);
  expect(seen.summaryYears.length).toBe(before + 1);
  expect(await page.evaluate(() => window.__sameDocument)).toBe(true);
});
