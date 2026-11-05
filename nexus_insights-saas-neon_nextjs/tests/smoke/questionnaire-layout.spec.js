/**
 * Smoke test — how the question being answered is laid out.
 *
 * The current question is ONE card: its number, its title (once), the information that goes with it,
 * the answer control, then the supporting tips and the small actions ("answer later", AI Help). The conversation above
 * it keeps only what is already behind the user. At every screen size nothing overflows sideways or hides a button.
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

const PHASE1 = { A1: { answer: 'Alpha' }, A2: { answer: 'x' }, A3: { answer: 'x' }, A4: { answer: '2025' }, A5: { answer: 'x' }, A6: { answer: 'x' },
  A7: { answer: 'no' }, B1: { answer: 'NACE_A' }, B2: { answer: 'Makes things' } };
const report = { report_id: 1, title: 'Inventory A', status: 'in_progress', reporting_year: 2025, current_step: 'B5',
  progress: { percent: 10, completed: 9, total: 98 }, updated_at: '2026-01-01T00:00:00Z', created_by: null };

const COPY = {
  en: { cont: /Continue/, q: 'What types of locations does your company operate?', n: 'Question 13', later: /answer later/i, help: 'Ask AI Help', info: 'Information', tip: 'How this works' },
  tr: { cont: /Devam/, q: 'Bu lokasyonların türleri neler?', n: 'Soru 13', later: /sonra yanıtla/i, help: 'AI Yardımı', info: 'Bilgi', tip: 'Nasıl ilerlenir' },
};

test.beforeEach(async ({ page }) => {
  await mockDjangoApi(page);
  await seedAuth(page);
  await page.context().addCookies([{ name: 'carbonless_mode_chosen', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax' }]);
  await page.route('http://localhost:8000/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/questionnaire/') return json({ reports: [report] });
    if (/^\/api\/questionnaire\/1\/$/.test(url.pathname)) {
      return json({ ...report, answers: PHASE1, completed_steps: Object.keys(PHASE1), advisor_rejected: [], advisor_pending: 0, pending_questions: [] });
    }
    return route.fallback();
  });
});

for (const lang of ['en', 'tr']) {
  const c = COPY[lang];
  for (const [name, size] of [['laptop', { width: 1366, height: 768 }], ['tablet', { width: 820, height: 1180 }], ['phone', { width: 390, height: 844 }]]) {
    test(`the question is one ordered card, with nothing overflowing (${lang}, ${name})`, async ({ page }) => {
      await page.addInitScript((l) => { localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1'); }, lang);
      await page.setViewportSize(size);
      await page.goto('/dashboard?tab=questionnaire');
      await page.getByRole('button', { name: c.cont }).first().click();

      const card = page.getByTestId('pinned-question');
      await expect(card).toContainText(c.n);
      await expect(card).not.toContainText('ISO 14064-1');                  // no ISO badge beside the number
      await expect(card).toContainText(c.q);

      // the title is shown once, not repeated in the conversation above
      await expect(page.getByText(c.q, { exact: true })).toHaveCount(1);

      // order down the page: title, information, the answer, the tips, then the small actions
      const y = async (loc) => (await loc.first().boundingBox()).y;
      const info = page.getByTestId('content-information').first();
      const answer = page.getByRole('radiogroup').first().or(page.getByRole('checkbox').first());
      const tip = page.getByTestId('content-instruction').first();
      await expect(info).toBeVisible();
      await expect(info).toContainText(c.info, { ignoreCase: true });
      expect(await y(card)).toBeLessThan(await y(info));
      expect(await y(info)).toBeLessThan(await y(answer));
      expect(await y(answer)).toBeLessThan(await y(tip));
      await expect(tip).toContainText(c.tip, { ignoreCase: true });

      // "answer later" and AI Help are reachable, inside the screen
      for (const btn of [page.getByTestId('answer-later-button'), page.getByRole('button', { name: c.help })]) {
        await btn.scrollIntoViewIfNeeded();
        const box = await btn.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow).toBe(false);
    });
  }
}
