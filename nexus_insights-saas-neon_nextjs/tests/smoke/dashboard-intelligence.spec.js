/**
 * Smoke test — the Carbon Intelligence dashboard (Main Dashboard).
 *
 * What it guards: every figure is the server's for the ONE inventory shown (three inventories of the same year are never
 * blended, and switching changes every number and every request); a figure that is not there is "not calculated", never a
 * zero; the insights say whether something is calculated, a warning, missing, or an AI action; the actions carry the right
 * inventory; English and Turkish; and the layout holds from a phone to a wide desktop (no sideways scroll, no nested
 * scrollbars). The Django backend is mocked (the summary of each state is below).
 */
import { test, expect } from '@playwright/test';
import { MOCK_TOKEN } from '../helpers/mock-api.js';

// The server lists the most recently updated inventory first (C), and the dashboard shows that one by default.
const REPORTS = [
  { report_id: 1, title: 'Inventory A', status: 'completed', reporting_year: 2025, current_step: '7B', updated_at: '2026-02-03T10:00:00Z', signed_at: null, advisor_pending: 0, advisor_rejected: 0, progress: { percent: 100, completed: 92, total: 92 } },
  { report_id: 2, title: 'Inventory B', status: 'in_progress', reporting_year: 2025, current_step: '3A-1', updated_at: '2026-03-04T10:00:00Z', signed_at: null, advisor_pending: 1, advisor_rejected: 0, progress: { percent: 38, completed: 35, total: 92 } },
  { report_id: 3, title: 'Inventory C', status: 'in_progress', reporting_year: 2025, current_step: '2A-2', updated_at: '2026-04-05T10:00:00Z', signed_at: null, advisor_pending: 0, advisor_rejected: 0, progress: { percent: 23, completed: 23, total: 98 } },
];
REPORTS.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
const STATUS = { 1: { required: [], pending: [] }, 2: { required: ['3A-2', '3A-3', '4A-1'], pending: ['A5'] }, 3: { required: Array.from({ length: 41 }, (_, i) => `Q${i}`), pending: ['A5', 'B7'] } };
// Each inventory has its own figures: a blend of them would match none of these.
const SUMMARY = {
  1: { total: 90.5, s1: 40.25, s2: 30.25, s3: 20.0, cat: 'electricity' },
  2: { total: 60.0, s1: 10.0, s2: 20.0, s3: 30.0, cat: 'waste' },
  3: { total: 184.62, s1: 71.4, s2: 58.22, s3: 55.0, cat: 'stationary_combustion' },
};
const summaryOf = (id) => {
  const f = SUMMARY[id];
  return {
    year: 2025, inventory_id: id, total_tonne: f.total, total_kg: f.total * 1000, scope1_tonne: f.s1, scope2_tonne: f.s2, scope3_tonne: f.s3,
    scope1_kg: f.s1 * 1000, scope2_kg: f.s2 * 1000, scope3_kg: f.s3 * 1000, annual_kg: 0,
    monthly: [{ month: 1, total_kg: 1000 }, { month: 2, total_kg: 3000 }, { month: 5, total_kg: 2000 }],
    by_category: [{ category: f.cat, total_kg: f.total * 1000 }], scope3_by_category: [],
    by_facility: id === 3 ? [{ facility_id: 7, facility_name: 'Gebze Plant', total_kg: f.total * 700 }, { facility_id: 8, facility_name: 'Izmir Office', total_kg: f.total * 250 }] : [], unassigned_kg: id === 3 ? f.total * 50 : 0,
    previous_year_change: id === 3 ? { change_pct: -12.4, previous_year: 2024, months: 12, previous_kg: 210000, current_kg: 184620 } : null,
    not_counted: id === 3 ? { pending: { count: 2, total_kg: 900 }, rejected: { count: 0, total_kg: 0 } } : {},
    unassigned_records: { entries: id === 3 ? 2 : 0, total_kg: 0 }, custom_emissions: { approved_total_kg: 0, pending_count: 0 }, years_with_data: [2025],
  };
};
const EMPTY = { year: 2025, inventory_id: 3, total_tonne: 0, total_kg: 0, scope1_tonne: 0, scope2_tonne: 0, scope3_tonne: 0, monthly: [], by_category: [], scope3_by_category: [], by_facility: [], years_with_data: [], unassigned_records: { entries: 0 }, not_counted: {}, custom_emissions: { pending_count: 0 } };

async function setup(page, { lang = 'en', scenario = 'populated', width = 1440, height = 900 } = {}) {
  await page.setViewportSize({ width, height });
  await page.context().addCookies([
    { name: 'carbonless_auth', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax' },
    { name: 'carbonless_mode_chosen', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax' },
  ]);
  await page.addInitScript(([token, l]) => {
    localStorage.setItem('_ca', token); localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1');
    window.__ss = [];
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (this === window.sessionStorage) window.__ss.push([k, v]); return set.call(this, k, v); };
  }, [MOCK_TOKEN, lang]);
  const calls = [];
  await page.route('http://localhost:8000/api/**', (route) => {
    const u = new URL(route.request().url()); const p = u.pathname;
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    calls.push(p + u.search);
    if (p === '/api/questionnaire/') return json({ reports: scenario === 'noinv' ? [] : REPORTS });
    const m = p.match(/^\/api\/questionnaire\/(\d+)\/$/);
    if (m) {
      const id = Number(m[1]); const r = REPORTS.find(x => x.report_id === id); const st = STATUS[id] || { required: [], pending: [] };
      return json({ report_id: id, title: r?.title, status: r?.status, answers: {}, completed_steps: Array.from({ length: r?.progress.completed || 0 }, (_, i) => `s${i}`), pending_questions: st.pending, required_unanswered: st.required, progress: r?.progress });
    }
    if (p.startsWith('/api/emissions/summary')) {
      const id = Number(u.searchParams.get('inventory_id') || 0);
      return json(scenario === 'populated' && SUMMARY[id] ? summaryOf(id) : EMPTY);
    }
    if (p.startsWith('/api/emissions/entries')) return json(scenario === 'populated' ? [{ id: 1, month: 1, status: 'approved', calculated_co2e_kg: '1000' }] : []);
    if (p.includes('/accounts/profile')) return json({ id: 1, username: 'smokeuser', email: 'smoke@carbonless.com', role: 'owner', company_name: 'Smoke Co' });
    if (p.includes('unread-count')) return json({ unread_count: 0 });
    if (p.includes('/companies/facilities')) return json([{ id: 7, name: 'Gebze Plant', city: 'Gebze', country: 'TR' }, { id: 8, name: 'Izmir Office', city: 'Izmir', country: 'TR' }]);
    return json([]);
  });
  await page.goto('/dashboard');
  await expect(page.getByTestId('kpi-row')).toBeVisible({ timeout: 40_000 });
  return calls;
}
const kpi = (page, id) => page.getByTestId(`kpi-${id}`);

for (const lang of ['en', 'tr']) {
  const t = lang === 'tr'
    ? { title: 'Karbon Emisyon Analitiği', completion: 'Tamamlanma', notYet: 'Henüz hesaplanmadı', noPrev: 'Karşılaştırılabilir önceki dönem yok', noInv: 'için envanter yok', facts: 'Hesaplanan', warn: 'Uyarı', ai: 'AI asistan', cont: 'Envantere devam et', pending: 'Bekleyen soruları incele' }
    : { title: 'Carbon Emissions Analytics', completion: 'Completion', notYet: 'Not calculated yet', noPrev: 'No comparable previous period', noInv: 'No inventory for', facts: 'Calculated', warn: 'Warning', ai: 'AI assistant', cont: 'Continue inventory', pending: 'Review pending questions' };

  test.describe(`dashboard (${lang})`, () => {
    test('the selected inventory\'s own figures, never a blend of the three of the year', async ({ page }) => {
      await setup(page, { lang });
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.title);
      await expect(kpi(page, 'total')).toContainText(lang === 'tr' ? '184,62' : '184.62');
      await expect(kpi(page, 'scope1')).toContainText(lang === 'tr' ? '71,40' : '71.40');
      await expect(kpi(page, 'scope2')).toContainText(lang === 'tr' ? '58,22' : '58.22');
      await expect(kpi(page, 'scope3')).toContainText(lang === 'tr' ? '55,00' : '55.00');
      await expect(kpi(page, 'total').getByTestId('kpi-total-badge')).toContainText(lang === 'tr' ? '12,4%' : '12.4%');
      await expect(page.getByTestId('inventory-status')).toContainText('23%');
      await expect(page.getByTestId('inventory-status-title')).toHaveText('Inventory C');
      await expect(page.getByTestId('header-context')).toContainText('Inventory C');
      await expect(page.getByTestId('inventory-status')).toContainText('1/3');          // one of the three inventories of the year
      await expect(page.getByTestId('inventory-status')).toContainText('41');          // required open, from the server's own list
    });

    test('switching inventory changes every figure and every request; nothing of the other one stays', async ({ page }) => {
      const calls = await setup(page, { lang });
      await page.getByRole('combobox', { name: /^(Inventory|Envanter)$/ }).selectOption({ label: 'Inventory B' });
      await expect(page.getByTestId('inventory-status-title')).toHaveText('Inventory B');
      await expect(kpi(page, 'total')).toContainText(lang === 'tr' ? '60,00' : '60.00');
      await expect(page.getByTestId('inventory-status')).toContainText('38%');
      await expect(page.getByTestId('inventory-status')).toContainText('3');           // B's three required questions, not C's 41
      await expect(page.getByTestId('inventory-status')).not.toContainText('41');
      await expect(kpi(page, 'total')).not.toContainText(lang === 'tr' ? '184,62' : '184.62');
      expect(calls.some(c => c.startsWith('/api/questionnaire/2/'))).toBe(true);
      expect(calls.filter(c => c.startsWith('/api/emissions/summary')).at(-1)).toContain('inventory_id=2');
      await page.getByRole('combobox', { name: /^(Inventory|Envanter)$/ }).selectOption({ label: 'Inventory A' });
      await expect(kpi(page, 'total')).toContainText(lang === 'tr' ? '90,50' : '90.50');
      await expect(page.getByTestId('inventory-status')).toContainText(lang === 'tr' ? 'Tamamlandı' : 'Completed');
    });

    test('what is not calculated says so; no made-up zero, no empty chart', async ({ page }) => {
      await setup(page, { lang, scenario: 'empty' });
      await expect(kpi(page, 'total')).toContainText(t.notYet);
      await expect(kpi(page, 'scope1')).toContainText(t.notYet);
      await expect(page.getByTestId('inventory-status')).toBeVisible();
      await expect(kpi(page, 'total')).not.toContainText(/0[.,]00/);
      // the charts keep their frames (labels, axes, an empty ring) but draw no value
      await expect(page.getByTestId('trend-card')).toContainText(lang === 'tr' ? 'Henüz aylık kayıt yok' : 'No monthly entries yet');
      await expect(page.getByTestId('trend-card')).toContainText(lang === 'tr' ? 'Ağu' : 'Aug');
      await expect(page.getByTestId('scope-card')).toContainText(lang === 'tr' ? 'Kapsam 3' : 'Scope 3');
      await expect(page.getByTestId('scope-card')).toContainText(lang === 'tr' ? 'Hesaplanmış emisyon yok' : 'No calculated emissions yet');
      await expect(page.getByTestId('sources-card')).toContainText(lang === 'tr' ? 'Elektrik' : 'Electricity');
      await expect(page.getByTestId('sources-card').locator('[style*="width"]')).toHaveCount(0);       // no bar is drawn
      await expect(page.getByTestId('performance-table')).toContainText(lang === 'tr' ? 'Hesaplanmış emisyon yok' : 'No calculated emissions yet');
      await expect(page.getByTestId('trend-card').locator('[style*="height"]').filter({ hasNot: page.locator('*') })).toHaveCount(0);
      await expect(page.getByTestId('insights-panel')).toContainText(lang === 'tr' ? 'Henüz hesaplanmış emisyon yok' : 'No emissions calculated yet');
    });

    test('a year with no inventory says so and offers to start one', async ({ page }) => {
      await setup(page, { lang, scenario: 'noinv' });
      await expect(page.getByTestId('inventory-status')).toContainText(lang === 'tr' ? 'için envanter yok' : /No inventory for 20\d\d/);
      await expect(page.getByTestId('inventory-status')).toContainText(lang === 'tr' ? 'Envanter başlat' : 'Start an inventory');
      await expect(page.getByTestId('insight-ask-ai')).toHaveCount(0);                 // nothing to ask the AI about
    });

    test('insights: calculated facts, warnings, and the AI action are labelled apart', async ({ page }) => {
      await setup(page, { lang });
      const panel = page.getByTestId('insights-panel');
      await expect(panel.locator('[data-kind="warning"]').first()).toContainText(t.warn);
      await expect(panel.locator('[data-kind="fact"]').first()).toContainText(t.facts);
      await expect(page.getByTestId('unassigned-note')).toContainText(/2 record|2 kayıt/);
      const ai = page.getByTestId('insight-ask-ai');
      await expect(ai).toContainText(t.ai);
      await expect(ai).toContainText(lang === 'tr' ? 'bulgu olarak gösterilmez' : 'not shown here as findings');
      // a fact is the server's number, phrased: Scope 1 is 71.40 of 184.62 = 39%
      await expect(panel).toContainText(lang === 'tr' ? "%39'ini" : '39%');
      // the sample-data benchmark card is gone from the dashboard
      await expect(page.getByText(/Sample comparison|Örnek karşılaştırma|With sample data|Örnek verilerle/)).toHaveCount(0);
    });

    test('the actions carry the inventory shown', async ({ page }) => {
      await setup(page, { lang });
      await page.getByTestId('action-pending').click();
      const ss = await page.evaluate(() => window.__ss);
      expect(ss).toContainEqual(['carbonless_continue_inventory', '3']);
      expect(ss).toContainEqual(['carbonless_open_pending', '1']);
    });

    test('the scope explainer illustration is not on the dashboard, with data or without', async ({ page }) => {
      await setup(page, { lang });
      await expect(page.getByText(/Scopes 1, 2 and 3 explained|Kapsam 1, 2 ve 3 nedir/)).toHaveCount(0);
      await expect(page.locator('#main-content svg').filter({ hasText: 'Upstream activities' })).toHaveCount(0);
      await page.unroute('http://localhost:8000/api/**');
    });

    test('the scope explainer is gone from the empty dashboard too', async ({ page }) => {
      await setup(page, { lang, scenario: 'empty' });
      await expect(page.getByText(/Scopes 1, 2 and 3 explained|Kapsam 1, 2 ve 3 nedir/)).toHaveCount(0);
      await expect(page.getByText(/Upstream activities|Yukarı akış faaliyetleri/)).toHaveCount(0);
    });

    test('the emissions table lists the facilities of the inventory shown, with their location; the selects switch the views', async ({ page }) => {
      await setup(page, { lang });
      const table = page.getByTestId('performance-table');
      await expect(table).toContainText('Gebze Plant');
      await expect(table).toContainText('Gebze, TR');
      await expect(table).toContainText(lang === 'tr' ? '129,23' : '129.23');          // 70% of 184.62
      await table.getByRole('combobox').selectOption('sources');
      await expect(table).toContainText(lang === 'tr' ? 'Sabit Yanma' : 'Stationary Combustion');
      await page.getByTestId('trend-card').getByRole('combobox').selectOption('quarterly');
      await expect(page.getByTestId('trend-card')).toContainText('Q1');
      await expect(page.getByTestId('scope-card')).toContainText(lang === 'tr' ? 'Kapsam 1' : 'Scope 1');
    });

    test('emissions and report open the right tabs', async ({ page }) => {
      await setup(page, { lang });
      await page.getByTestId('action-emissions').click();
      await expect(page.getByTestId('kpi-row')).toHaveCount(0);                         // left the dashboard for the Emissions tab
      await page.getByRole('button', { name: /^(Dashboard|Kontrol Paneli)$/ }).first().click();
      await expect(page.getByTestId('kpi-row')).toBeVisible();
      await page.getByTestId('action-report').click();
      await expect(page.getByTestId('kpi-row')).toHaveCount(0);
    });
  });
}

test.describe('frame', () => {
  test('toolbar: title, search, profile; sidebar: Carbon AI card on a tall screen', async ({ page }) => {
    await setup(page, { width: 1440, height: 900 });
    await expect(page.getByTestId('header-context')).toContainText(/Dashboard/);
    await expect(page.getByTestId('header-search')).toBeVisible();
    await expect(page.getByTestId('header-profile')).toContainText('smokeuser');
    await expect(page.getByTestId('sidebar-ai-card')).toBeVisible();
    await page.getByTestId('header-search').click();                                  // opens the command palette
    await expect(page.getByRole('dialog').or(page.getByPlaceholder(/search|ara/i)).first()).toBeVisible();
  });
});

test.describe('density: the dashboard reads at a glance', () => {
  for (const [name, w, h] of [['1440x900', 1440, 900], ['1366x768', 1366, 768]]) {
    test(`${name}: KPIs, the three analytics panels and the lower row are on the first screen`, async ({ page }) => {
      await setup(page, { width: w, height: h });
      await page.waitForTimeout(600);
      const need = ['kpi-total', 'kpi-scope3', 'trend-card', 'scope-card', 'sources-card', 'performance-table', 'inventory-status', 'reduction-card'];
      for (const id of need) {
        const b = await page.getByTestId(id).boundingBox();
        expect(b, id).not.toBeNull();
        expect(b.y + b.height, `${id} fits the first screen`).toBeLessThanOrEqual(h);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    });
    test(`${name}: with nothing calculated the charts still show their frames, on the same first screen`, async ({ page }) => {
      await setup(page, { width: w, height: h, scenario: 'empty' });
      await page.waitForTimeout(600);
      for (const id of ['kpi-total', 'trend-card', 'scope-card', 'sources-card']) {
        const b = await page.getByTestId(id).boundingBox();
        expect(b, id).not.toBeNull();
        expect(b.y + b.height, `${id} fits the first screen`).toBeLessThanOrEqual(h);
      }
      for (const id of ['performance-table', 'inventory-status', 'reduction-card']) await expect(page.getByTestId(id)).toBeVisible();
    });
  }
});

test.describe('layout', () => {
  for (const [name, w, h] of [['1920x1080', 1920, 1080], ['1440x900', 1440, 900], ['1366x768', 1366, 768], ['tablet', 820, 1180], ['phone', 390, 844]]) {
    for (const scenario of ['populated', 'empty']) {
      test(`${name} ${scenario}: four KPI cards, no sideways scroll, a single scrollbar`, async ({ page }) => {
        await setup(page, { width: w, height: h, scenario });
        await page.waitForTimeout(500);
        const m = await page.evaluate(() => {
          const main = document.querySelector('#main-content');
          const nested = [...main.querySelectorAll('*')].filter(el => {
            const s = getComputedStyle(el); return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2 && el.getBoundingClientRect().height > 0;
          }).length;
          return { overflowX: document.documentElement.scrollWidth > innerWidth + 1, mainX: main.scrollWidth > main.clientWidth + 1, nested,
            kpis: document.querySelectorAll('[data-testid="kpi-total"], [data-testid^="kpi-scope"]').length };
        });
        expect(m.overflowX).toBe(false);
        expect(m.mainX).toBe(false);
        expect(m.nested).toBe(0);
        expect(m.kpis).toBe(4);
        await expect(page.getByTestId('inventory-status')).toBeVisible();
        await expect(page.getByTestId('insights-panel')).toBeVisible();
        const nav = page.getByRole('button', { name: /^(Dashboard|Kontrol Paneli)$/ }).first();
        await expect(nav).toBeVisible();                                                  // navigation stays reachable
      });
    }
  }
});
