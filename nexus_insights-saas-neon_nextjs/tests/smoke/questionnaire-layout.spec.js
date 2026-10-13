/**
 * Layout verification — questionnaire question/input region height share
 *
 * Guards the fix for the "cramped question panel" bug: the current-question
 * (AnswerInput) region used to be `shrink`-only, so the sibling chat-messages
 * region (`flex-1`) ate all the vertical space and multi-field questions were
 * clipped into a tiny inner scrollbar.
 *
 * The fix rebalances the flex distribution inside the survey main column:
 *   • chat-messages div   : flex-1            -> min-h-0 flex-1   (grow 1)
 *   • question/input div  : min-h-0 shrink    -> min-h-0 flex-[2_1_0%] (grow 2)
 *
 * This test starts a fresh inventory (backend mocked) to render the real
 * survey view, then measures the computed heights of the two sibling flex
 * regions. It asserts the question/input region is NOT squeezed to a tiny box
 * and gets a generous share of the panel height (roughly the larger share,
 * per the grow-2 vs grow-1 ratio).
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

test.beforeEach(async ({ page }) => {
  await mockDjangoApi(page);
  // The questionnaire "Start" button posts to /questionnaire/start/. The
  // catch-all mock returns [] which lacks report_id/current_step, so override
  // it with a well-formed response that drops us on the first question (A1).
  await page.route('http://localhost:8000/api/questionnaire/start/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ report_id: 9999, title: 'Layout Test', current_step: 'A1' }),
    });
  });
  await seedAuth(page);
  // The dashboard is gated by a mode-selection screen (/dashboard/select) until
  // the `carbonless_mode_chosen` cookie is set; seed it so /dashboard renders the
  // real dashboard. Also pin the active tab to the questionnaire so the survey
  // surface (the one we fixed) mounts directly.
  await page.context().addCookies([{
    name: 'carbonless_mode_chosen', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax',
  }]);
  await page.addInitScript(() => {
    localStorage.setItem('carbonless_active_tab', 'questionnaire');
  });
});

test('question/input region gets a fair height share (not a cramped scroll box)', async ({ page }) => {
  test.setTimeout(90_000);
  // Use a normal desktop height so the comparison is meaningful.
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto('/dashboard?tab=questionnaire');
  await page.waitForLoadState('domcontentloaded');

  // Start a new inventory. The library screen has a "Start" / "Başla" button
  // that opens a naming dialog; the dialog's primary button is ALSO
  // "Start" / "Başla" and triggers handleStartNew(). Click the first one to
  // open the dialog, then the dialog's primary button to confirm.
  const startBtn = page.getByRole('button', { name: /^Start$|^Başla$/ }).first();
  await expect(startBtn).toBeVisible({ timeout: 30_000 });
  await startBtn.click();

  // Dialog confirm — the last "Start"/"Başla" button on screen is the dialog's.
  const dialogConfirm = page.getByRole('button', { name: /^Start$|^Başla$/ }).last();
  await dialogConfirm.click();

  // The survey's question/input region is the div we edited to flex-[2_1_0%]
  // (flex-grow:2). Note the page ALSO mounts the AI assistant chat panel (its
  // composer is a different border-t region), so we must target the specific
  // element by its unique grow-2 signature, not `.last()`.
  // Wait for the survey question region to render (its AnswerInput lives under
  // a .max-w-2xl wrapper inside the grow-2 border-t region).
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('div.border-t')).some(
      (el) => getComputedStyle(el).flexGrow === '2'
    );
  }, { timeout: 30_000 });

  // Grab the computed geometry of the question region and its flex sibling
  // (the chat-messages scroll area is its sibling with overflow-y auto).
  const metrics = await page.evaluate(() => {
    const qEl = Array.from(document.querySelectorAll('div.border-t')).find(
      (el) => getComputedStyle(el).flexGrow === '2'
    );
    if (!qEl) return { found: false };
    const parent = qEl.parentElement;
    const siblings = Array.from(parent.children).filter((c) => c instanceof HTMLElement);
    const messagesEl = siblings.find(
      (c) => c !== qEl && getComputedStyle(c).overflowY === 'auto'
    );
    const q = qEl.getBoundingClientRect();
    const m = messagesEl ? messagesEl.getBoundingClientRect() : null;
    const qStyle = getComputedStyle(qEl);
    const mStyle = messagesEl ? getComputedStyle(messagesEl) : null;
    return {
      found: true,
      parentHeight: parent.getBoundingClientRect().height,
      questionHeight: q.height,
      questionGrow: qStyle.flexGrow,
      questionOverflowY: qStyle.overflowY,
      questionClass: qEl.className,
      messagesHeight: m ? m.height : null,
      messagesGrow: mStyle ? mStyle.flexGrow : null,
      messagesOverflowY: mStyle ? mStyle.overflowY : null,
    };
  });

  expect(metrics.found).toBe(true);

  console.log('LAYOUT METRICS', JSON.stringify(metrics, null, 2));

  // 1. The fix is present: question region grows (flex-grow 2) and still scrolls.
  expect(metrics.questionGrow).toBe('2');
  expect(metrics.questionOverflowY).toBe('auto');

  // 2. The messages region keeps grow 1 and its own scroll (history still scrolls).
  expect(metrics.messagesGrow).toBe('1');
  expect(metrics.messagesOverflowY).toBe('auto');

  // 3. The question region is NOT a cramped short box: it occupies a generous
  //    share of the panel (well above the old shrink-to-content tiny box). The
  //    grow-2/grow-1 split gives it the majority, so >=45% is a safe lower bound.
  expect(metrics.questionHeight).toBeGreaterThan(metrics.parentHeight * 0.45);

  // 4. The question region gets at least as much height as the messages region
  //    (grow 2 vs grow 1), confirming the chat no longer starves it.
  expect(metrics.questionHeight).toBeGreaterThanOrEqual(metrics.messagesHeight);
});
