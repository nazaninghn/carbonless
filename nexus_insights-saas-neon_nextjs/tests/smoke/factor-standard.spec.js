/**
 * Smoke test — the factor standard of an inventory.
 *
 * The standard (GHG Protocol / IPCC / DEFRA / Mix) is the FIRST question of an inventory. In a "Mix"
 * inventory every calculating question carries its own standard: the picker is shown there, an answer
 * is not sent without it, and the choice travels with the answer as `factor_standard`.
 * The Django backend is mocked (helpers/mock-api.js); nothing real is saved.
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

const REPORT = { report_id: 93, title: 'Inventory 2025', status: 'in_progress', reporting_year: 2025,
  progress: { percent: 5 }, updated_at: '2026-01-01T00:00:00Z', created_by: null };

async function mockInventoryApi(page, answers, step) {
  const seen = { saved: [] };
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
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/step-standard/` && req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      seen.standards = [...(seen.standards || []), body];
      return json({ success: true, step: body.step, factor_standard: body.factor_standard,
        reporting_year: REPORT.reporting_year, calc_feedback: { delta_kg: 12.5, total_kg: 100, pending: false, notes: [] } });
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
    sessionStorage.setItem('carboniq_open_request', JSON.stringify(step ? { report_id: id, step_id: step } : { report_id: id }));
  }, [lang, REPORT.report_id, stepId]);
}

const WASTE = { 'K3C5-0': { answer: 'yes' }, 'K3C5-1': { answer: 'S2_total' } };
const submit = (page) => page.getByRole('button', { name: /^(Confirm|Onayla|Continue|Devam|Send|Gönder|Submit)/ }).first();

for (const lang of ['en', 'tr']) {
  test.describe(`factor standard (${lang})`, () => {
    test('a new inventory is asked for its standard first, then for the company name', async ({ page }) => {
      await open(page, lang, null);
      const seen = await mockInventoryApi(page, {}, 'D1');
      await page.goto('/dashboard?tab=questionnaire');
      const pinned = page.getByTestId('pinned-question');
      await expect(pinned).toHaveAttribute('data-question-id', 'D1');
      await expect(pinned).toContainText(lang === 'tr' ? 'Soru 1' : 'Question 1');
      await expect(pinned).toContainText(lang === 'tr' ? /standardına göre hesaplansın/ : /standard should your inventory be calculated on/);
      const panel = page.getByTestId('input-panel');
      for (const name of lang === 'tr' ? ['GHG Protokolü', 'IPCC', 'DEFRA', 'Karma'] : ['GHG Protocol', 'IPCC', 'DEFRA', 'Mix']) {
        await expect(panel.getByText(name, { exact: false }).first()).toBeVisible();
      }
      await panel.getByText(/^DEFRA/).first().click();
      await submit(page).click().catch(() => {});
      await expect.poll(() => seen.saved.length).toBe(1);
      expect(seen.saved[0].step).toBe('D1');
      expect(seen.saved[0].data).toEqual({ ef_database: 'std_defra' });
      await expect(pinned).toHaveAttribute('data-question-id', 'A1');
      await expect(pinned).toContainText(lang === 'tr' ? 'Soru 2' : 'Question 2');
    });

    test('a mix inventory asks each calculating question for its standard and sends it with the answer', async ({ page }) => {
      await open(page, lang, 'K3C5-2b');
      const seen = await mockInventoryApi(page, { D1: { ef_database: 'std_mix' }, ...WASTE }, 'K3C5-2b');
      await page.goto('/dashboard?tab=questionnaire');
      await expect(page.getByTestId('pinned-question')).toHaveAttribute('data-question-id', 'K3C5-2b');
      const picker = page.getByTestId('step-standard-select');
      await expect(picker).toBeVisible();
      await expect(picker).toHaveValue('');
      await page.getByTestId('input-panel').locator('input:not([type="hidden"])').first().fill('1000');
      await submit(page).click();
      await expect(page.getByText(lang === 'tr' ? /önce bu soru için emisyon faktörü standardını seçin/ : /first choose the emission factor standard for this question/)).toBeVisible();
      expect(seen.saved.length).toBe(0);                                     // nothing was sent
      await picker.selectOption('defra');
      await submit(page).click();
      await expect.poll(() => seen.saved.length).toBe(1);
      expect(seen.saved[0].step).toBe('K3C5-2b');
      expect(seen.saved[0].data.factor_standard).toBe('defra');
    });

    test('a saved choice is shown again, and changing it on an answered question is saved at once', async ({ page }) => {
      await open(page, lang, 'K3C5-2b');
      const seen = await mockInventoryApi(page, { D1: { ef_database: 'std_mix' }, ...WASTE,
        'K3C5-2b': { answer: '1000', factor_standard: 'ipcc' } }, 'K3C5-2b');
      await page.goto('/dashboard?tab=questionnaire');
      const picker = page.getByTestId('step-standard-select');
      await expect(picker).toHaveValue('ipcc');
      await picker.selectOption('defra');
      await expect.poll(() => (seen.standards || []).length).toBe(1);        // sent without re-entering the answer
      expect(seen.standards[0]).toMatchObject({ step: 'K3C5-2b', factor_standard: 'defra' });
      expect(seen.saved.length).toBe(0);                                     // the answer itself was not saved again
      await expect(picker).toHaveValue('defra');
    });

    test('an inventory on one standard shows no picker on its questions', async ({ page }) => {
      await open(page, lang, 'K3C5-2b');
      await mockInventoryApi(page, { D1: { ef_database: 'std_defra' }, ...WASTE }, 'K3C5-2b');
      await page.goto('/dashboard?tab=questionnaire');
      await expect(page.getByTestId('pinned-question')).toHaveAttribute('data-question-id', 'K3C5-2b');
      await expect(page.getByTestId('step-standard')).toHaveCount(0);
    });
  });
}

for (const [name, use] of [
  ['phone', { viewport: { width: 390, height: 844 } }],
  ['reduced motion', { reducedMotion: 'reduce' }],
]) {
  test.describe(`factor standard picker — ${name}`, () => {
    test.use(use);
    test('the picker is visible and fits the panel', async ({ page }) => {
      await open(page, 'en', 'K3C5-2b');
      await mockInventoryApi(page, { D1: { ef_database: 'std_mix' }, ...WASTE }, 'K3C5-2b');
      await page.goto('/dashboard?tab=questionnaire');
      const box = page.getByTestId('step-standard');
      await expect(box).toBeVisible();
      const [b, vw] = [await box.boundingBox(), page.viewportSize().width];
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(vw);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
}
