/**
 * Smoke test — several inventories can share a reporting year
 *
 * Drives the real Inventory page against a small STATEFUL mock of the questionnaire API (the Django
 * backend is mocked, see helpers/mock-api.js): three inventories of 2023 are listed as three cards,
 * the new-inventory dialog no longer blocks a year that already has one, renaming and deleting act on
 * the selected card only, and the dashboard's data calls name the inventory they show.
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

const mk = (id, title, year, percent, done, total) => ({
  report_id: id, title, status: 'in_progress', reporting_year: year, current_step: 'A1',
  progress: { percent, completed: done, total }, updated_at: `2026-01-0${id}T00:00:00Z`, created_by: null,
});

async function mockInventories(page) {
  const state = {
    reports: [mk(3, 'Inventory C', 2023, 12, 8, 70), mk(2, 'Inventory B', 2023, 65, 45, 70), mk(1, 'Inventory A', 2023, 29, 20, 70)],
    started: [], renamed: [], deleted: [], summaries: [], entries: [],
  };
  await page.route('http://localhost:8000/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/emissions/summary/') {
      state.summaries.push(Object.fromEntries(url.searchParams));
    } else if (url.pathname === '/api/emissions/entries/') {
      state.entries.push(Object.fromEntries(url.searchParams));
    } else if (url.pathname === '/api/questionnaire/' && req.method() === 'GET') {
      state.lists = (state.lists || 0) + 1;
      return json(200, { reports: state.reports });
    } else if (url.pathname === '/api/questionnaire/start/' && req.method() === 'POST') {
      const body = req.postDataJSON();
      state.started.push(body);
      const id = 10 + state.started.length;
      state.reports = [mk(id, body.title || 'New', body.reporting_year, 0, 0, null), ...state.reports];
      return json(201, { report_id: id, title: body.title, reporting_year: body.reporting_year, current_step: 'A1', bot_messages: [] });
    } else if (/^\/api\/questionnaire\/\d+\/title\/$/.test(url.pathname) && req.method() === 'PATCH') {
      const id = Number(url.pathname.split('/')[3]);
      const title = req.postDataJSON().title;
      state.renamed.push({ id, title });
      state.reports = state.reports.map(r => (r.report_id === id ? { ...r, title } : r));
      return json(200, { success: true, report_id: id, title });
    } else if (/^\/api\/questionnaire\/\d+\/$/.test(url.pathname) && req.method() === 'DELETE') {
      const id = Number(url.pathname.split('/')[3]);
      state.deleted.push(id);
      state.reports = state.reports.filter(r => r.report_id !== id);
      return json(200, { deleted_entries: 4 });
    }
    return route.fallback();
  });
  return state;
}

// The card of an inventory: the nearest ancestor of its title that holds its Continue button.
const titleOf = (page, title) => page.locator('#main-content p', { hasText: new RegExp(`^${title}$`) });
const cardOf = (page, title) => titleOf(page, title).locator(
  'xpath=ancestor::div[.//button[contains(normalize-space(),"Continue") or contains(normalize-space(),"Devam")]][1]');

test.beforeEach(async ({ page }) => {
  await mockDjangoApi(page);
  await seedAuth(page);
  await page.context().addCookies([{
    name: 'carbonless_mode_chosen', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax',
  }]);
});

test('three inventories of one year are three separate cards, each with its own progress', async ({ page }) => {
  await mockInventories(page);
  await page.goto('/dashboard?tab=questionnaire');
  for (const [title, pct, counts] of [['Inventory A', 29, '20 / 70'], ['Inventory B', 65, '45 / 70'], ['Inventory C', 12, '8 / 70']]) {
    const card = cardOf(page, title);
    await expect(card).toContainText(`${pct}%`);
    await expect(card).toContainText(counts);
  }
  await expect(page.getByText(/Reporting year|Raporlama yılı/).first()).toBeVisible();
  // no "another inventory covers this year" warning on any card
  await expect(page.getByText(/share the same emission records|aynı emisyon kayıtlarını paylaşır/)).toHaveCount(0);
});

test('the new-inventory dialog does not block a year that already has inventories', async ({ page }) => {
  const state = await mockInventories(page);
  await page.goto('/dashboard?tab=questionnaire');
  await page.getByRole('button', { name: /^(Start|Başla)$/ }).first().click();
  await page.getByRole('dialog').getByLabel(/Reporting year|Raporlama yılı/).selectOption('2023');
  await expect(page.getByText(/already an inventory|zaten bir envanteriniz var|one inventory per year/)).toHaveCount(0);
  await page.getByPlaceholder(/e\.g\.|Örnek/).fill('Inventory D');
  const start = page.getByRole('dialog').getByRole('button', { name: /^(Start|Başla)$/ });
  await expect(start).toBeEnabled();
  await start.click();
  await expect.poll(() => state.started.length).toBe(1);
  expect(state.started[0]).toMatchObject({ title: 'Inventory D', reporting_year: 2023, force_new: true });
});

test('renaming and deleting act on the selected card only', async ({ page }) => {
  const state = await mockInventories(page);
  await page.goto('/dashboard?tab=questionnaire');
  await cardOf(page, 'Inventory B').getByRole('button', { name: /Rename|Yeniden adlandır/ }).click();
  await page.getByLabel(/Inventory name|Envanter adı/).fill('Renamed B');
  await page.getByRole('button', { name: /^(Save|Kaydet)$/ }).click();
  await expect.poll(() => state.renamed).toEqual([{ id: 2, title: 'Renamed B' }]);
  await expect(titleOf(page, 'Renamed B')).toBeVisible();
  await expect(titleOf(page, 'Inventory A')).toBeVisible();
  await expect(titleOf(page, 'Inventory C')).toBeVisible();

  await cardOf(page, 'Renamed B').getByRole('button', { name: /^(Delete|Sil)$/ }).click();
  await expect(page.getByText(/Only this inventory|Yalnızca bu envanterin/)).toBeVisible();
  await page.getByRole('button', { name: /^(Yes, delete|Evet, sil)$/ }).click();
  await expect.poll(() => state.deleted).toEqual([2]);
  await expect(titleOf(page, 'Renamed B')).toHaveCount(0);
  await expect(titleOf(page, 'Inventory A')).toBeVisible();
  await expect(titleOf(page, 'Inventory C')).toBeVisible();
});

test('dashboard data calls name the inventory they show, and the header offers the others', async ({ page }) => {
  const state = await mockInventories(page);
  await page.goto('/dashboard');
  // the most recently updated inventory of the year (C = 3) is shown by default
  await expect.poll(() => state.summaries.at(-1)?.inventory_id).toBe('3');
  await expect.poll(() => state.entries.at(-1)?.inventory_id).toBe('3');
  const selector = page.getByRole('combobox', { name: /^(Inventory|Envanter)$/ });
  await expect(selector).toBeVisible();
  await selector.selectOption({ label: 'Inventory A' });
  await expect.poll(() => state.summaries.at(-1)?.inventory_id).toBe('1');
  await expect.poll(() => state.entries.at(-1)?.inventory_id).toBe('1');
  // the choice survives a refresh (remembered per user and year, validated against the server's list)
  await page.reload();
  await expect.poll(() => state.summaries.at(-1)?.inventory_id).toBe('1');
});

test('records that belong to no inventory are explained and listed, never added to the inventory figures', async ({ page }) => {
  await mockInventories(page);
  const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/emissions/summary/**', route => json(route, {
    total_tonne: 5, scope1_tonne: 5, scope2_tonne: 0, scope3_tonne: 0, total_kg: 5000, monthly: [], by_category: [],
    unassigned_records: { entries: 2, total_kg: 1500 },
  }));
  await page.route('**/api/emissions/entries/**', route => {
    const q = new URL(route.request().url()).searchParams;
    return json(route, q.get('unassigned') ? [
      { id: 91, description: 'chat gas', month: 2, status: 'approved', calculated_co2e_kg: '1000', inventory_id: null },
      { id: 92, description: 'chat power', month: 3, status: 'approved', calculated_co2e_kg: '500', inventory_id: null },
    ] : []);
  });
  await page.goto('/dashboard');
  await expect(page.getByTestId('unassigned-note')).toContainText(/2 record|2 kayıt/, { timeout: 20_000 });
  await page.goto('/dashboard?tab=emissions');
  const panel = page.getByTestId('unassigned-records');
  await expect(panel).toContainText(/not assigned to any inventory|hiçbir envantere atanmamış/);
  await expect(panel).toContainText(/never assigned automatically|otomatik olarak atanmazlar/);
  await panel.getByRole('button', { name: /Show records|Kayıtları göster/ }).click();
  await expect(panel.getByText('chat gas')).toBeVisible();
  await expect(panel.getByText(/^(Unassigned|Atanmamış)$/)).toHaveCount(2);
});

test('a deleted inventory in an open chat is refused clearly, the list is refreshed and nothing is answered', async ({ page }) => {
  const state = await mockInventories(page);
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  let sent = 0;
  await page.route(/\/api\/chat\/sessions\/.*/, route => {
    const url = route.request().url(), method = route.request().method();
    if (/\/sessions\/$/.test(url) && method === 'GET') return json(route, []);
    if (/\/sessions\/new\/$/.test(url)) return json(route, { id: 7, title: 'New Chat', updated_at: new Date().toISOString(), message_count: 0 }, 201);
    if (/\/message\/$/.test(url)) {
      sent += 1;
      return json(route, { error: 'Inventory not found for your company.', code: 'inventory_not_found' }, 400);
    }
    return json(route, { id: 7, messages: [] });
  });
  await page.goto('/dashboard');
  await expect.poll(() => state.summaries.at(-1)?.inventory_id).toBe('3');
  const listsBefore = state.lists || 0;
  await page.getByRole('button', { name: /Ask Carbon AI|Carbon AI'ya sorun/ }).click();
  const input = page.getByTestId('ai-assistant-panel').locator('textarea');
  await input.fill('how much did we emit?');
  await input.press('Enter');
  await expect(page.getByTestId('ai-assistant-panel')).toContainText(/no longer exists|artık yok/);
  await expect(page.getByTestId('ai-assistant-panel')).toContainText(/choose a valid inventory|geçerli bir envanter seçip/);
  expect(sent).toBe(1);
  await expect.poll(() => state.lists || 0).toBeGreaterThan(listsBefore);        // the inventory list was read again
  await expect(input).toHaveValue('how much did we emit?');                       // the text is given back, not lost
  // and no phantom question stays among the messages (the text lives only in the input, which is a textarea)
  const phantom = await page.getByTestId('ai-assistant-panel').evaluate(el => [...el.querySelectorAll('*')].filter(
    n => n.tagName !== 'TEXTAREA' && n.children.length === 0 && (n.textContent || '').includes('how much did we emit?')).length);
  expect(phantom).toBe(0);
});

test('a failed inventory list says what kind of failure it was, never blames the connection for a server error, and Try again recovers', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  let mode = '500';
  await page.route('http://localhost:8000/api/questionnaire/', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    if (mode === '500') {
      return route.fulfill({ status: 500, contentType: 'text/html',
        body: 'OperationalError: no such column: questionnaire_carbonreport.ownership_linked  (File "views.py", line 1725)' });
    }
    if (mode === '403') return route.fulfill({ status: 403, contentType: 'application/json', body: '{"detail":"no access"}' });
    if (mode === 'abort') return route.abort('failed');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reports: [mk(1, 'Inventory A', 2023, 29, 20, 70)] }) });
  });
  await page.goto('/dashboard?tab=questionnaire');
  const alert = page.getByRole('alert').filter({ hasText: /couldn't be loaded|yüklenemedi/ });
  await expect(alert).toContainText(/HTTP 500/, { timeout: 20_000 });
  await expect(alert).toContainText(/not caused by your connection|bağlantınızdan kaynaklanmıyor/);
  await expect(alert).not.toContainText(/internet connection|OperationalError|ownership_linked|views\.py/);   // no server internals, no false blame
  await expect(alert).toContainText(/not deleted|silinmedi/);
  // the rest of the dashboard did not break
  await expect(page.getByRole('button', { name: /Try again|Tekrar dene/ })).toBeVisible();
  await expect(page.locator('#main-content')).toBeVisible();
  mode = 'abort';
  await page.getByRole('button', { name: /Try again|Tekrar dene/ }).click();
  await expect(alert).toContainText(/could not be reached|ulaşılamadı/);
  mode = '403';
  await page.getByRole('button', { name: /Try again|Tekrar dene/ }).click();
  await expect(alert).toContainText(/session may have expired|süresi dolmuş/);
  mode = 'ok';
  await page.getByRole('button', { name: /Try again|Tekrar dene/ }).click();
  await expect(titleOf(page, 'Inventory A')).toBeVisible();
  await expect(alert).toHaveCount(0);
  expect(consoleErrors.filter(t => /Failed to load inventories|Inventory list request/.test(t))).toEqual([]);   // no dev-overlay console.error
});
