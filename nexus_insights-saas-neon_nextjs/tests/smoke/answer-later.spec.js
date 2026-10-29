/**
 * Smoke test — “I don't know — answer later” in the Inventory questionnaire.
 *
 * The Django backend is mocked (see helpers/mock-api.js); nothing real is saved. The mock keeps the
 * pending list the way the server does: marking stores only the question id (no answer), the status
 * response returns it, and saving an answer for that question clears it.
 *
 * All copy follows the UI language, so every check runs in English and in Turkish.
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

const REPORT = { report_id: 77, title: 'Inventory 2025', status: 'in_progress', reporting_year: 2025,
  progress: { percent: 10 }, updated_at: '2026-01-01T00:00:00Z', created_by: null };
const STEP = '4A-EF';          // “Does your electricity supplier have an official emission declaration?”
const COPY = {
  en: { button: "I don't know — answer later", title: 'Pending questions', banner: 'You have unanswered questions in this Inventory.',
        back: 'Return to question', badge: 'Unanswered',
        q: 'Does your electricity supplier have an official emission declaration?', no: 'No — no declaration available' },
  tr: { button: 'Bilmiyorum — sonra yanıtla', title: 'Bekleyen sorular', banner: 'Bu envanterde yanıtlanmamış sorularınız var.',
        back: 'Soruya dön', badge: 'Yanıtsız',
        q: 'Elektrik tedarikçinizin resmi emisyon beyanı var mı?', no: 'Hayır — beyan yok' },
};

/** The inventory API as the server behaves: a pending list that only holds ids. */
async function mockInventoryApi(page, { pending = [] } = {}) {
  const seen = { pending: [...pending], answers: { A1: { answer: 'x' } }, marks: [], saved: [] };
  await page.route('http://localhost:8000/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/questionnaire/' && req.method() === 'GET') return json({ reports: [REPORT] });
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/` && req.method() === 'GET') {
      return json({ report_id: REPORT.report_id, title: REPORT.title, status: REPORT.status, current_step: STEP,
        answers: seen.answers, completed_steps: Object.keys(seen.answers), reporting_year: 2025, progress: { percent: 10 },
        advisor_rejected: [], advisor_pending: 0, pending_questions: seen.pending });
    }
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/pending/` && req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      seen.marks.push(body);
      seen.pending = body.pending ? [...new Set([...seen.pending, body.step])] : seen.pending.filter(s => s !== body.step);
      return json({ report_id: REPORT.report_id, step: body.step, pending: body.pending, pending_questions: seen.pending });
    }
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/step/` && req.method() === 'PATCH') {
      const body = JSON.parse(req.postData() || '{}');
      seen.saved.push(body);
      seen.answers = { ...seen.answers, [body.step]: body.data };
      seen.pending = seen.pending.filter(s => s !== body.step);
      return json({ success: true, step: body.step, reporting_year: REPORT.reporting_year });
    }
    return route.fallback();
  });
  return seen;
}

for (const lang of ['en', 'tr']) {
  const c = COPY[lang];

  test.describe(`answer later (${lang})`, () => {
    test.beforeEach(async ({ page }) => {
      await mockDjangoApi(page);
      await seedAuth(page);
      await page.context().addCookies([{ name: 'carbonless_mode_chosen', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax' }]);
      await page.addInitScript(([l, step, id]) => {
        localStorage.setItem('language', l);
        localStorage.setItem('language_explicit', '1');
        // Opens that exact question, as "edit this answer" does.
        sessionStorage.setItem('carboniq_open_request', JSON.stringify({ report_id: id, step_id: step }));
      }, [lang, STEP, REPORT.report_id]);
    });

    test('the action is offered beside the question and marks it without saving an answer', async ({ page }) => {
      const seen = await mockInventoryApi(page);
      await page.goto('/dashboard?tab=questionnaire');
      const button = page.getByTestId('answer-later-button');
      await expect(button).toBeVisible();
      await expect(button).toHaveText(c.button);

      await button.click();
      await expect.poll(() => seen.marks).toEqual([{ step: STEP, pending: true, language: lang }]);
      expect(seen.saved).toEqual([]);                                   // no answer was submitted
      await expect(page.getByTestId('pending-questions-panel')).toBeVisible();
      await expect(page.getByTestId('pending-questions-panel')).toContainText(c.banner);
    });

    test('a pending question survives a reload and returns to the original question', async ({ page }) => {
      const seen = await mockInventoryApi(page, { pending: [STEP] });
      await page.goto('/dashboard?tab=questionnaire');
      const panel = page.getByTestId('pending-questions-panel');
      await expect(panel).toContainText(c.banner);
      await page.getByTestId('pending-questions-toggle').click();
      const item = page.getByTestId(`pending-question-${STEP}`);
      await expect(item).toContainText(c.badge);
      await expect(item.getByRole('button', { name: new RegExp(c.back) })).toBeVisible();
      expect(seen.saved).toEqual([]);

      await page.reload();
      await expect(page.getByTestId('pending-questions-panel')).toContainText(c.banner);   // from the server, not page state
    });

    test('the pending panel is hidden when nothing is pending', async ({ page }) => {
      await mockInventoryApi(page);
      await page.goto('/dashboard?tab=questionnaire');
      await expect(page.getByTestId('answer-later-button')).toBeVisible();
      await expect(page.getByTestId('pending-questions-panel')).toHaveCount(0);
    });

    // The question on screen is pinned above the answer controls; it names the question and its number.
    const pinned = (page) => page.getByTestId('pinned-question');

    test('Return to question reopens the original question and saves no answer', async ({ page }) => {
      const seen = await mockInventoryApi(page);
      await page.goto('/dashboard?tab=questionnaire');
      await expect(pinned(page)).toContainText(c.q);

      await page.getByTestId('answer-later-button').click();
      await expect(page.getByTestId('answer-later-notice')).toBeVisible();
      await expect(pinned(page)).not.toContainText(c.q);                    // moved on to the next question
      await page.getByTestId('pending-questions-toggle').click();
      await expect(page.getByTestId(`pending-question-${STEP}`)).toContainText(c.badge);

      await page.getByTestId(`pending-question-${STEP}`).getByRole('button', { name: new RegExp(c.back) }).click();
      await expect(pinned(page)).toContainText(c.q);                        // the original question, not the start
      await expect(pinned(page)).toContainText('76');
      await expect(page.getByTestId('pending-questions-list')).toHaveCount(0);   // the list closes on return
      await expect(page.getByRole('radio', { name: c.no })).toHaveAttribute('aria-checked', 'false');   // nothing preselected
      expect(seen.saved).toEqual([]);                                        // returning submitted nothing
      expect(seen.pending).toEqual([STEP]);                                  // and it is still pending
      expect(seen.marks).toHaveLength(1);
    });

    test('answering a pending question saves the answer and clears it from the list', async ({ page }) => {
      const seen = await mockInventoryApi(page);
      await page.goto('/dashboard?tab=questionnaire');
      await page.getByTestId('answer-later-button').click();
      await expect(pinned(page)).not.toContainText(c.q);
      await page.getByTestId('pending-questions-toggle').click();
      await page.getByTestId(`pending-question-${STEP}`).getByRole('button', { name: new RegExp(c.back) }).click();
      await expect(pinned(page)).toContainText(c.q);

      await page.getByRole('radio', { name: c.no }).click();                // single-select answers submit on click
      await expect.poll(() => seen.saved.length).toBe(1);
      expect(seen.saved[0].step).toBe(STEP);
      expect(seen.saved[0].data).toEqual({ answer: 'no' });                  // the normal answer payload
      expect(seen.saved[0].language).toBe(lang);
      expect(seen.marks).toHaveLength(1);                                    // no second "later" request
      expect(seen.pending).toEqual([]);

      await expect(page.getByTestId('pending-questions-panel')).toHaveCount(0);
      await expect(page.getByTestId(`pending-question-${STEP}`)).toHaveCount(0);
    });
  });
}
