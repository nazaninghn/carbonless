/**
 * Smoke test — the data source of a calculating question (measurement / invoice / estimate).
 *
 * Every question whose answer becomes an emission shows where its figure comes from. Nothing chosen is
 * read as an estimate and the user is told the accuracy is theirs to answer for; the choice travels with
 * the answer as `data_source`, and on an answered question it is saved at once without re-entering it.
 * The percentages and the formulas are proved on the real backend in questionnaire/test_uncertainty.py.
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

const REPORT = { report_id: 94, title: 'Inventory 2025', status: 'in_progress', reporting_year: 2025,
  progress: { percent: 5 }, updated_at: '2026-01-01T00:00:00Z', created_by: null };
const WASTE = { D1: { ef_database: 'std_defra' }, 'K3C5-0': { answer: 'yes' }, 'K3C5-1': { answer: 'S2_total' } };

async function mockInventoryApi(page, answers, step) {
  const seen = { saved: [], sources: [] };
  await page.route('http://localhost:8000/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/questionnaire/' && req.method() === 'GET') return json({ reports: [REPORT] });
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/` && req.method() === 'GET') {
      return json({ report_id: REPORT.report_id, title: REPORT.title, status: REPORT.status, current_step: step,
        answers, completed_steps: Object.keys(answers), reporting_year: 2025, progress: { percent: 5 },
        advisor_rejected: [], advisor_pending: 0, pending_questions: [] });
    }
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/previous-profile/`) return json({ available: false });
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/step-data-source/` && req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      seen.sources.push(body);
      return json({ success: true, step: body.step, data_source: body.data_source, warning: '',
        uncertainty: { total_kg: 100, absolute_kg: 30, percent: 30, low_kg: 70, high_kg: 130 } });
    }
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/step/` && req.method() === 'PATCH') {
      const body = JSON.parse(req.postData() || '{}');
      seen.saved.push(body);
      return json({ success: true, step: body.step, reporting_year: REPORT.reporting_year });
    }
    return route.fallback();
  });
  return seen;
}

async function open(page, lang, stepId) {
  await mockDjangoApi(page);
  await seedAuth(page);
  await page.context().addCookies([{ name: 'carbonless_mode_chosen', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax' }]);
  await page.addInitScript(([l, id, step]) => {
    localStorage.setItem('language', l);
    localStorage.setItem('language_explicit', '1');
    sessionStorage.setItem('carboniq_open_request', JSON.stringify({ report_id: id, step_id: step }));
  }, [lang, REPORT.report_id, stepId]);
}

const submit = (page) => page.getByRole('button', { name: /^(Confirm|Onayla|Continue|Devam|Send|Gönder|Submit)/ }).first();

for (const lang of ['en', 'tr']) {
  test.describe(`data source (${lang})`, () => {
    test('nothing chosen is read as an estimate and said so; the choice is sent with the answer', async ({ page }) => {
      await open(page, lang, 'K3C5-2b');
      const seen = await mockInventoryApi(page, WASTE, 'K3C5-2b');
      await page.goto('/dashboard?tab=questionnaire');
      await expect(page.getByTestId('pinned-question')).toHaveAttribute('data-question-id', 'K3C5-2b');
      const picker = page.getByTestId('data-source-select');
      const warning = page.getByTestId('data-source-warning');
      await expect(picker).toHaveValue('');
      await expect(warning).toContainText(lang === 'tr' ? 'tahmin (±%20) olarak sayılır' : 'counted as an estimate (±20 %)');
      await expect(warning).toContainText(lang === 'tr' ? 'sorumluluğundadır' : 'responsibility');
      await picker.selectOption('estimate');
      await expect(warning).toContainText(lang === 'tr' ? 'doğruluğunu düşürür' : 'lowers the accuracy');
      await picker.selectOption('invoice');
      await expect(warning).toContainText(lang === 'tr' ? '±%7' : '±7 %');
      expect(seen.sources.length).toBe(0);                                   // not answered yet: nothing sent on its own
      await page.getByTestId('input-panel').locator('input:not([type="hidden"])').first().fill('1000');
      await submit(page).click();
      await expect.poll(() => seen.saved.length).toBe(1);
      expect(seen.saved[0].step).toBe('K3C5-2b');
      expect(seen.saved[0].data.data_source).toBe('invoice');
    });

    test('a saved source is shown again, and changing it on an answered question is saved at once', async ({ page }) => {
      await open(page, lang, 'K3C5-2b');
      const seen = await mockInventoryApi(page, { ...WASTE, 'K3C5-2b': { answer: '1000', data_source: 'estimate' } }, 'K3C5-2b');
      await page.goto('/dashboard?tab=questionnaire');
      const picker = page.getByTestId('data-source-select');
      await expect(picker).toHaveValue('estimate');
      await picker.selectOption('measurement');
      await expect.poll(() => seen.sources.length).toBe(1);
      expect(seen.sources[0]).toMatchObject({ step: 'K3C5-2b', data_source: 'measurement' });
      expect(seen.saved.length).toBe(0);                                     // the answer itself was not saved again
      await expect(page.getByTestId('data-source-warning')).toContainText(lang === 'tr' ? '±%1' : '±1 %');
    });

    test('a question that calculates nothing shows no data source', async ({ page }) => {
      await open(page, lang, 'A1');
      await mockInventoryApi(page, { D1: { ef_database: 'std_defra' } }, 'A1');
      await page.goto('/dashboard?tab=questionnaire');
      await expect(page.getByTestId('pinned-question')).toHaveAttribute('data-question-id', 'A1');
      await expect(page.getByTestId('data-source')).toHaveCount(0);
    });
  });
}

for (const [name, use] of [
  ['phone', { viewport: { width: 390, height: 844 } }],
  ['reduced motion', { reducedMotion: 'reduce' }],
]) {
  test.describe(`data source picker — ${name}`, () => {
    test.use(use);
    test('the picker and its warning are visible and fit the panel', async ({ page }) => {
      await open(page, 'tr', 'K3C5-2b');
      await mockInventoryApi(page, WASTE, 'K3C5-2b');
      await page.goto('/dashboard?tab=questionnaire');
      const box = page.getByTestId('data-source');
      await expect(box).toBeVisible();
      const b = await box.boundingBox();
      const vw = page.viewportSize().width;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(vw + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vw + 1);
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/data-source-${name.replace(' ', '-')}.png` });
    });
  });
}
