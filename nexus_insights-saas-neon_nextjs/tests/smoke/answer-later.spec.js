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
// B3 “What is your total number of employees?”: profile data, before no gate depends on it — deferrable.
// (4A-EF, the supplier-declaration question this spec used to use, routes the questionnaire: it is required now.)
const STEP = 'B3';
const COPY = {
  en: { button: "I don't know — answer later", title: 'Pending questions', banner: 'This inventory has unanswered questions.',
        back: 'Return to question', badge: 'Unanswered',
        q: 'What is your total number of employees?', no: '1–50 employees' },
  tr: { button: 'Bilmiyorum — sonra yanıtla', title: 'Bekleyen sorular', banner: 'Bu envanterde yanıtlanmamış sorularınız var.',
        back: 'Soruya dön', badge: 'Yanıtsız',
        q: 'Toplam çalışan sayınız nedir?', no: '1–50 çalışan' },
};

/** The inventory API as the server behaves: a pending list that only holds ids. */
// Phase 1 up to the question under test, all answered: a required question left unanswered BEHIND the user is listed
// by the "needs attention" overview (questionnaire-ux.spec.js), so these tests start from an inventory with none.
const BEHIND = { A1: { answer: 'x' }, A2: { answer: 'x' }, A3: { answer: 'x' }, A4: { answer: '2025' }, A5: { answer: 'x' }, A6: { answer: 'x' },
  A7: { answer: 'no' }, B1: { answer: 'NACE_A' }, B2: { answer: 'x' } };
async function mockInventoryApi(page, { pending = [], step = STEP, answers = BEHIND, marksStatus = 200 } = {}) {
  const seen = { pending: [...pending], answers: { ...answers }, marks: [], saved: [] };
  await page.route('http://localhost:8000/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/questionnaire/' && req.method() === 'GET') return json({ reports: [REPORT] });
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/` && req.method() === 'GET') {
      return json({ report_id: REPORT.report_id, title: REPORT.title, status: REPORT.status, current_step: step,
        answers: seen.answers, completed_steps: Object.keys(seen.answers), reporting_year: 2025, progress: { percent: 10 },
        advisor_rejected: [], advisor_pending: 0, pending_questions: seen.pending });
    }
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/pending/` && req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      seen.marks.push(body);
      if (marksStatus !== 200) return json({ error: 'refused', code: 'not_deferrable' }, marksStatus);
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
      await expect(pinned(page)).toContainText('11');
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
      expect(seen.saved[0].data).toMatchObject({ employee_band: '1-50' });   // the normal answer payload
      expect(seen.saved[0].language).toBe(lang);
      expect(seen.marks).toHaveLength(1);                                    // no second "later" request
      expect(seen.pending).toEqual([]);

      await expect(page.getByTestId('pending-questions-panel')).toHaveCount(0);
      await expect(page.getByTestId(`pending-question-${STEP}`)).toHaveCount(0);
    });

    // ── which questions may be left for later (the policy: questionnaire/deferral.py, lib/carboniq/deferral.js) ──
    test('Question 36 (how to answer Scope 1 and 2) offers no "answer later": it decides the route', async ({ page }) => {
      await page.addInitScript(([id]) => {
        sessionStorage.setItem('carboniq_open_request', JSON.stringify({ report_id: id, step_id: 'SCOPE-GROUPING' }));
      }, [REPORT.report_id]);
      await mockInventoryApi(page, { step: 'SCOPE-GROUPING' });
      await page.goto('/dashboard?tab=questionnaire');
      await expect(page.getByTestId('pinned-question')).toContainText('36');
      await expect(page.getByRole('radio', { name: lang === 'tr' ? /Birlikte/ : /Together/ })).toBeVisible();
      await expect(page.getByTestId('answer-later-button')).toHaveCount(0);
    });

    test('a yes/no gate offers no "answer later" either', async ({ page }) => {
      await page.addInitScript(([id]) => {
        sessionStorage.setItem('carboniq_open_request', JSON.stringify({ report_id: id, step_id: '3A-0' }));
      }, [REPORT.report_id]);
      await mockInventoryApi(page, { step: '3A-0' });
      await page.goto('/dashboard?tab=questionnaire');
      await expect(page.getByTestId('pinned-question')).toContainText(lang === 'tr' ? /yakıt yakan/i : /stationary combustion/i);
      await expect(page.getByTestId('answer-later-button')).toHaveCount(0);
    });

    test('a required text question says why it cannot be left for later when the user tries to go on blank', async ({ page }) => {
      await page.addInitScript(([id]) => {
        sessionStorage.setItem('carboniq_open_request', JSON.stringify({ report_id: id, step_id: '2A-1' }));
      }, [REPORT.report_id]);
      await mockInventoryApi(page, { step: '2A-1' });
      await page.goto('/dashboard?tab=questionnaire');
      await expect(page.getByTestId('answer-later-button')).toHaveCount(0);
      await page.getByRole('textbox').first().press('Enter');                 // submit it empty
      const why = page.getByTestId('required-explanation');
      await expect(why).toBeVisible();
      await expect(why).toContainText(lang === 'tr' ? /sonraya bırakılamaz/i : /cannot be left for later/i);
    });

    test('a refusal from the server (the policy is enforced there too) is shown, and nothing is marked', async ({ page }) => {
      const seen = await mockInventoryApi(page, { marksStatus: 400 });
      await page.goto('/dashboard?tab=questionnaire');
      await page.getByTestId('answer-later-button').click();
      await expect.poll(() => seen.marks.length).toBe(1);
      await expect(page.getByTestId('pending-questions-panel')).toHaveCount(0);
      expect(seen.pending).toEqual([]);
      expect(seen.saved).toEqual([]);
    });

    test('a pending question the answers have taken off the route is not listed', async ({ page }) => {
      // 4A-EF-a only applies when the supplier-declaration gate (4A-EF) says yes; here it says no.
      await mockInventoryApi(page, { pending: ['4A-EF-a'], answers: { ...BEHIND, '4A-EF': { answer: 'no' } } });
      await page.goto('/dashboard?tab=questionnaire');
      await expect(page.getByTestId('answer-later-button')).toBeVisible();
      await expect(page.getByTestId('pending-questions-panel')).toHaveCount(0);
    });
  });
}
