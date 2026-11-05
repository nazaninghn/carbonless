/**
 * Smoke test — questionnaire routing around a question the answers hide.
 *
 * K3C14-0 ("Does your franchise network have emission data?") exists only for companies with franchises
 * (C3 = yes). For every other company it is skipped; the skip must continue to the NEXT question
 * (K3C15-0, investments). It used to have no default route, so the skip found nowhere to go and the
 * questionnaire announced "All questions completed" — leaving out category 15, the Scope 3 summary, all of
 * Stage 6 and the sign-off. The Django backend is mocked (helpers/mock-api.js); nothing real is saved.
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

const REPORT = { report_id: 91, title: 'Inventory 2025', status: 'in_progress', reporting_year: 2025,
  progress: { percent: 40 }, updated_at: '2026-01-01T00:00:00Z', created_by: null };

async function mockInventoryApi(page, answers, step) {
  const seen = { saved: [] };
  await page.route('http://localhost:8000/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/questionnaire/' && req.method() === 'GET') return json({ reports: [REPORT] });
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/` && req.method() === 'GET') {
      return json({ report_id: REPORT.report_id, title: REPORT.title, status: REPORT.status, current_step: step,
        answers, completed_steps: Object.keys(answers), reporting_year: 2025, progress: { percent: 40 },
        advisor_rejected: [], advisor_pending: 0, pending_questions: [] });
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

for (const lang of ['en', 'tr']) {
  test.describe(`questionnaire routing (${lang})`, () => {
    test.beforeEach(async ({ page }) => {
      await mockDjangoApi(page);
      await seedAuth(page);
      await page.context().addCookies([{ name: 'carbonless_mode_chosen', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax' }]);
      await page.addInitScript(([l, id]) => {
        localStorage.setItem('language', l);
        localStorage.setItem('language_explicit', '1');
        sessionStorage.setItem('carboniq_open_request', JSON.stringify({ report_id: id, step_id: 'K3C13-0' }));
      }, [lang, REPORT.report_id]);
    });

    test('with no franchise, "No" at category 13 goes on to category 15 — the questionnaire is not over', async ({ page }) => {
      const seen = await mockInventoryApi(page, { A1: { answer: 'x' }, C3: { has_jv_franchise: false } }, 'K3C13-0');
      await page.goto('/dashboard?tab=questionnaire');
      const pinned = page.getByTestId('pinned-question');
      await expect(pinned).toContainText('103');                                           // K3C13-0
      await page.getByRole('radio', { name: lang === 'tr' ? /^Hayır/ : /^No/ }).click();
      await expect.poll(() => seen.saved.length).toBe(1);
      // the next thing is the end-of-section summary or category 15 itself: the questionnaire goes on
      await expect(pinned.or(page.getByText('Section Summary'))).toBeVisible();
      await expect(page.getByText(/All questions completed|Tüm sorular tamamlandı|Survey Completed/)).toHaveCount(0);
      await page.getByRole('button', { name: lang === 'tr' ? /Devam/ : /Continue/ }).first().click().catch(() => {});
      await expect(pinned).toContainText(lang === 'tr' ? /finansal yatırım/i : /financial investments/i);   // K3C15-0
    });

    test('with a franchise, "No" at category 13 still asks the franchise question', async ({ page }) => {
      const seen = await mockInventoryApi(page, { A1: { answer: 'x' }, C3: { has_jv_franchise: true } }, 'K3C13-0');
      await page.goto('/dashboard?tab=questionnaire');
      await expect(page.getByTestId('pinned-question')).toContainText('103');
      await page.getByRole('radio', { name: lang === 'tr' ? /^Hayır/ : /^No/ }).click();
      await expect.poll(() => seen.saved.length).toBe(1);
      await expect(page.getByTestId('pinned-question').or(page.getByText('Section Summary'))).toBeVisible();
      await expect(page.getByText(/All questions completed|Tüm sorular tamamlandı|Survey Completed/)).toHaveCount(0);
      await page.getByRole('button', { name: lang === 'tr' ? /Devam/ : /Continue/ }).first().click().catch(() => {});
      await expect(page.getByTestId('pinned-question')).toContainText('104');              // K3C14-0: the franchise question
    });
  });
}
