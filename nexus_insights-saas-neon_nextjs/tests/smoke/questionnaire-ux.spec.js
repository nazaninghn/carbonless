/**
 * Smoke test — the questionnaire's navigation, its "needs attention" overview and how its text is presented.
 *
 * Three things a user hits when working on an inventory:
 *   1. a persistent way back to "My Inventories" (the page that lists inventories and creates a new one), that keeps the
 *      inventory's answers and progress and asks before dropping an answer that was typed but not submitted;
 *   2. an overview of WHICH questions still need attention: required ones left unanswered and ones left with
 *      "answer later", each with a button to its question; questions the answers make unnecessary (inactive branches,
 *      empty loops) are not listed as pending, and appear only as "not needed";
 *   3. text that is not the question (an explanation, a stage introduction, a reaction to an answer) shown as a labelled,
 *      distinct panel — never as italic text inside the question.
 *
 * The Django backend is mocked with a small STATEFUL API (helpers/mock-api.js for the rest): two inventories of the same
 * year with their own answers; every saved step is recorded against the inventory it was sent to.
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

const mk = (id, title, step, answers, pending = []) => ({
  report_id: id, title, status: 'in_progress', reporting_year: 2025, current_step: step, answers, pending,
  progress: { percent: 10, completed: 3, total: 70 }, updated_at: `2026-01-0${id}T00:00:00Z`, created_by: null,
});
// stage 1 stores the NEXT question as the current step
const NEXT = { B3: 'B4', B4: 'B5', B5: 'B6' };

async function mockInventories(page, reports) {
  const state = { reports: Object.fromEntries(reports.map(r => [r.report_id, structuredClone(r)])), saved: [], marks: [] };
  await page.route('http://localhost:8000/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/questionnaire/' && req.method() === 'GET') {
      return json({ reports: Object.values(state.reports).map(({ answers, pending, ...r }) => r) });
    }
    const m = url.pathname.match(/^\/api\/questionnaire\/(\d+)\/(step\/|pending\/)?$/);
    if (m) {
      const r = state.reports[Number(m[1])];
      if (!r) return json({ error: 'not found' }, 404);
      if (!m[2] && req.method() === 'GET') {
        return json({ report_id: r.report_id, title: r.title, status: r.status, current_step: r.current_step,
          answers: r.answers, completed_steps: Object.keys(r.answers), reporting_year: r.reporting_year, progress: r.progress,
          advisor_rejected: [], advisor_pending: 0, pending_questions: r.pending });
      }
      if (m[2] === 'step/' && req.method() === 'PATCH') {
        const body = JSON.parse(req.postData() || '{}');
        state.saved.push({ inventory: r.report_id, step: body.step });
        r.answers = { ...r.answers, [body.step]: body.data };
        r.pending = r.pending.filter(s => s !== body.step);
        r.current_step = NEXT[body.step] || body.step;
        return json({ success: true, step: body.step, reporting_year: r.reporting_year });
      }
      if (m[2] === 'pending/' && req.method() === 'POST') {
        const body = JSON.parse(req.postData() || '{}');
        state.marks.push({ inventory: r.report_id, ...body });
        r.pending = body.pending ? [...new Set([...r.pending, body.step])] : r.pending.filter(s => s !== body.step);
        return json({ report_id: r.report_id, step: body.step, pending: body.pending, pending_questions: r.pending });
      }
    }
    return route.fallback();
  });
  return state;
}

const COPY = {
  en: { mine: 'My Inventories', stay: 'Stay', leave: 'Leave anyway', cont: /Continue/, opt: '1–50 employees', q: 'What is your total number of employees?' },
  tr: { mine: 'Envanterlerim', stay: 'Burada kal', leave: 'Yine de ayrıl', cont: /Devam/, opt: '1–50 çalışan', q: 'Toplam çalışan sayınız nedir?' },
};

test.beforeEach(async ({ page }) => {
  await mockDjangoApi(page);
  await seedAuth(page);
  await page.context().addCookies([{ name: 'carbonless_mode_chosen', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax' }]);
});
const setLang = (page, lang) => page.addInitScript((l) => {
  localStorage.setItem('language', l);
  localStorage.setItem('language_explicit', '1');
}, lang);

// The card of an inventory (as in inventory-same-year.spec.js): the nearest ancestor of its title that holds Continue.
const cardOf = (page, title) => page.locator('#main-content p', { hasText: new RegExp(`^${title}$`) }).locator(
  'xpath=ancestor::div[.//button[contains(normalize-space(),"Continue") or contains(normalize-space(),"Devam")]][1]');
const openInventory = async (page, title, lang) => {
  await cardOf(page, title).getByRole('button', { name: COPY[lang].cont }).first().click();
  await expect(page.getByTestId('back-to-inventories')).toBeVisible();
};

// Phase 1 as far as B3, every question answered (the shapes the real status response uses are normalised by the app)
const PHASE1 = { A1: { answer: 'x' }, A2: { answer: 'x' }, A3: { answer: 'x' }, A4: { answer: '2025' }, A5: { answer: 'x' }, A6: { answer: 'x' },
  A7: { answer: 'no' }, B1: { answer: 'NACE_A' }, B2: { answer: 'x' } };
const ANSWERS_A = { ...PHASE1, A1: { answer: 'Alpha' } };
const ANSWERS_B = { ...PHASE1, A1: { answer: 'Bravo' }, B2: { answer: 'Bravo makes things' } };

for (const lang of ['en', 'tr']) {
  const c = COPY[lang];

  test.describe(`back to My Inventories (${lang})`, () => {
    test.beforeEach(async ({ page }) => { await setLang(page, lang); });

    test('a persistent button leads back to the list; the inventory keeps what was submitted; another inventory of the same year stays separate', async ({ page }) => {
      const state = await mockInventories(page, [mk(1, 'Inventory A', 'B3', ANSWERS_A), mk(2, 'Inventory B', 'B3', ANSWERS_B)]);
      await page.goto('/dashboard?tab=questionnaire');
      await openInventory(page, 'Inventory A', lang);
      await expect(page.getByTestId('pinned-question')).toContainText(c.q);
      await page.getByRole('radio', { name: new RegExp(`^${c.opt}`) }).click();
      await page.getByRole('button', { name: /^(Confirm|Onayla|Continue|Devam)/ }).first().click().catch(() => {});
      await expect.poll(() => state.saved.length).toBe(1);
      expect(state.saved[0]).toEqual({ inventory: 1, step: 'B3' });

      // the button is in the questionnaire's own header: visible with no scrolling, named for where it goes
      const back = page.getByTestId('back-to-inventories');
      await expect(back).toContainText(c.mine);
      await back.click();
      // the list: both inventories of the year, each its own card
      await expect(cardOf(page, 'Inventory A')).toBeVisible();
      await expect(cardOf(page, 'Inventory B')).toBeVisible();

      // the other inventory opens on ITS question with its own answers; nothing was saved to it
      await openInventory(page, 'Inventory B', lang);
      await expect(page.getByTestId('pinned-question')).toContainText(c.q);
      expect(state.saved.filter(s => s.inventory === 2)).toEqual([]);
      await page.getByTestId('back-to-inventories').click();

      // and the first one kept the answer it was given (it resumes after B3, and the server holds B3)
      await openInventory(page, 'Inventory A', lang);
      expect(state.reports[1].answers.B3).toBeTruthy();
      expect(state.reports[2].answers.B3).toBeUndefined();
      expect(state.saved.every(s => s.inventory === 1)).toBe(true);
    });

    test('an answer typed but not submitted is asked about first; "stay" keeps it, "leave" goes back without saving it', async ({ page }) => {
      const { B2, ...rest } = ANSWERS_A;
      const state = await mockInventories(page, [mk(1, 'Inventory A', 'B2', rest)]);
      await page.goto('/dashboard?tab=questionnaire');
      await openInventory(page, 'Inventory A', lang);
      const field = page.locator('textarea, input[type="text"]').first();
      await field.fill('We make things');                                                // typed, not submitted
      await page.getByTestId('back-to-inventories').click();
      const ask = page.getByTestId('leave-questionnaire-confirm');
      await expect(ask).toBeVisible();
      await page.getByTestId('leave-questionnaire-stay').click();
      await expect(ask).toHaveCount(0);
      await expect(field).toHaveValue('We make things');                                   // still there
      await page.getByTestId('back-to-inventories').click();
      await page.getByTestId('leave-questionnaire-yes').click();
      await expect(cardOf(page, 'Inventory A')).toBeVisible();
      expect(state.saved).toEqual([]);                                                    // nothing was saved by leaving
      expect(state.reports[1].answers.B2).toBeUndefined();
    });

    test('with nothing typed, leaving is immediate (no question asked)', async ({ page }) => {
      await mockInventories(page, [mk(1, 'Inventory A', 'B3', ANSWERS_A)]);
      await page.goto('/dashboard?tab=questionnaire');
      await openInventory(page, 'Inventory A', lang);
      await page.getByTestId('back-to-inventories').click();
      await expect(page.getByTestId('leave-questionnaire-confirm')).toHaveCount(0);
      await expect(cardOf(page, 'Inventory A')).toBeVisible();
    });
  });

  test.describe(`questions needing attention (${lang})`, () => {
    test.beforeEach(async ({ page }) => { await setLang(page, lang); });

    // Inventory at B3 (employees). Behind it: A2 (tax number; required content, not answered) and A5 (left for later).
    // A7a does not apply (A7 = no); 3A-2 is a per-equipment question of a loop with no equipment.
    const { A2, A5, ...ANSWERED } = ANSWERS_A;
    const SETUP = () => mk(1, 'Inventory A', 'B3', ANSWERED, ['A5', '3A-2', 'A7a']);

    test('required-unanswered and "answer later" are listed apart; inactive and empty-loop questions are not pending', async ({ page }) => {
      await mockInventories(page, [SETUP()]);
      await page.goto('/dashboard?tab=questionnaire');
      await openInventory(page, 'Inventory A', lang);
      const panel = page.getByTestId('pending-questions-panel');
      await expect(panel).toBeVisible();
      await page.getByTestId('pending-questions-toggle').click();
      const required = page.getByTestId('attention-group-required');
      const later = page.getByTestId('attention-group-deferred');
      await expect(required.getByTestId('pending-question-A2')).toHaveAttribute('data-status', 'required');
      await expect(later.getByTestId('pending-question-A5')).toHaveAttribute('data-status', 'deferred');
      await expect(page.getByTestId('pending-question-A7a')).toHaveCount(0);              // its condition does not hold
      await expect(page.getByTestId('pending-question-3A-2')).toHaveCount(0);             // a loop with no items
      // the count is what is listed: one required + one later
      await expect(page.getByTestId('pending-questions-toggle')).toContainText(lang === 'tr' ? '2 soru bekliyor' : '2 questions waiting');
    });

    test('the sidebar marks the stage and lists the questions that are not needed, with no pending status', async ({ page }) => {
      await mockInventories(page, [SETUP()]);
      await page.goto('/dashboard?tab=questionnaire');
      await openInventory(page, 'Inventory A', lang);
      await expect(page.getByTestId('stage-attention-1')).toBeVisible();
      const inactive = page.getByTestId('inactive-questions');
      await expect(inactive).toBeVisible();
      await inactive.locator('summary').click();
      await expect(page.getByTestId('inactive-question-A7a')).toBeVisible();
      await expect(page.getByTestId('inactive-question-A2')).toHaveCount(0);              // an active question is never "not needed"
    });

    test('each unanswered question has a button that opens it; the answers already saved are untouched', async ({ page }) => {
      const state = await mockInventories(page, [SETUP()]);
      await page.goto('/dashboard?tab=questionnaire');
      await openInventory(page, 'Inventory A', lang);
      await page.getByTestId('pending-questions-toggle').click();
      const row = page.getByTestId('pending-question-A2');
      const number = (await row.locator('span.font-bold').first().innerText()).replace(/\D+/g, '');
      await row.getByRole('button').click();
      await expect(page.getByTestId('pinned-question')).toContainText(new RegExp(`${lang === 'tr' ? 'Soru' : 'Question'} ${number}(?!\d)`));
      expect(state.saved).toEqual([]);                                                    // going there saved nothing
      expect(state.reports[1].answers.A2).toBeUndefined();                                // and made up no answer
      expect(state.reports[1].pending).toEqual(['A5', '3A-2', 'A7a']);                    // the stored marks are as they were
    });

    test('a question deferred before it became required is listed as required and says so', async ({ page }) => {
      const r = mk(1, 'Inventory A', '2A-2', ANSWERS_A, ['2A-1']);
      await mockInventories(page, [r]);
      await page.goto('/dashboard?tab=questionnaire');
      await openInventory(page, 'Inventory A', lang);
      await page.getByTestId('pending-questions-toggle').click();
      await expect(page.getByTestId('attention-group-required').getByTestId('pending-question-2A-1')).toBeVisible();
      await expect(page.getByTestId('attention-group-deferred')).toHaveCount(0);
    });
  });

  test.describe(`content kinds (${lang})`, () => {
    test.beforeEach(async ({ page }) => { await setLang(page, lang); });

    test('the explanation of a question is an information panel apart from the question', async ({ page }) => {
      await mockInventories(page, [mk(1, 'Inventory A', 'B5', ANSWERS_A)]);
      await page.goto('/dashboard?tab=questionnaire');
      await openInventory(page, 'Inventory A', lang);
      const info = page.getByTestId('content-information').first();
      await expect(info).toBeVisible();
      await expect(info).toHaveAttribute('data-content-kind', 'information');
      await expect(info).toContainText(lang === 'tr' ? 'Birden fazla seçebilirsiniz' : 'You may select multiple options');
      await expect(info).not.toContainText(lang === 'tr' ? 'Bu lokasyonların türleri neler' : 'What types of locations does your company operate');
      // the question itself is not inside the panel, and the helper is not italic text of the question
      await expect(page.getByTestId('pinned-question')).toContainText(lang === 'tr' ? 'Bu lokasyonların türleri neler' : 'What types of locations');
      await expect(page.locator('[data-testid="content-information"] em')).toHaveCount(0);
    });

    test('a stage introduction is an instruction, and a reaction to an answer is information', async ({ page }) => {
      await mockInventories(page, [mk(1, 'Inventory A', '2A-0', ANSWERS_A)]);
      await page.addInitScript(() => sessionStorage.setItem('carboniq_open_request', JSON.stringify({ report_id: 1, step_id: '2A-0' })));
      await page.goto('/dashboard?tab=questionnaire');
      await expect(page.getByTestId('content-instruction').first()).toBeVisible();
      await expect(page.getByTestId('content-instruction').first()).toHaveAttribute('data-content-kind', 'instruction');
      // an instruction is not selectable and is not a question: it has no radio / checkbox inside
      await expect(page.getByTestId('content-instruction').first().locator('[role="radio"], [role="checkbox"], input')).toHaveCount(0);
    });
  });
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 760 } });
  test('the way back is on screen, and the overview and the explanation fit', async ({ page }) => {
    await setLang(page, 'en');
    await mockInventories(page, [mk(1, 'Inventory A', 'B3', (({ A5, ...r }) => r)(ANSWERS_A), ['A5'])]);
    await page.goto('/dashboard?tab=questionnaire');
    await cardOf(page, 'Inventory A').getByRole('button', { name: /Continue/ }).first().click();
    const back = page.getByTestId('back-to-inventories');
    await expect(back).toBeVisible();
    const box = await back.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    await page.getByTestId('pending-questions-toggle').click();
    const list = await page.getByTestId('pending-questions-list').boundingBox();
    expect(list.x + list.width).toBeLessThanOrEqual(375 + 1);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(376);                                       // no sideways scroll
    await back.click();
    await expect(cardOf(page, 'Inventory A')).toBeVisible();
  });
});
