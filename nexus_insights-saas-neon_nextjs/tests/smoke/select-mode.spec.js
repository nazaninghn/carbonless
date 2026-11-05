/**
 * Smoke test — the first screen after login, /dashboard/select ("How would you like to work today?").
 *
 * It must show BOTH choices with their complete cards and buttons on a laptop screen without scrolling — including a
 * browser at 125-150% display scaling (a CSS viewport of about 1280 x 590) — and adapt on a phone (cards stacked, natural
 * scrolling only when the screen is genuinely too small). Presentation only: picking a mode sets the same startup
 * mode / tab / cookie as before and goes to /dashboard.
 */
import { test, expect } from '@playwright/test';
import { MOCK_TOKEN } from '../helpers/mock-api.js';

const T = {
  en: { title: 'How would you like to work today?', ai: 'Start with AI', dash: 'Go to Dashboard' },
  tr: { title: 'Bugün nasıl çalışmak istersiniz?', ai: 'AI ile başla', dash: "Dashboard'a git" },
};
// [name, width, height, fitsWithoutScrolling]
const SIZES = [
  ['1366x768', 1366, 768, true], ['1366x850', 1366, 850, true], ['1440x900', 1440, 900, true], ['1920x1080', 1920, 1080, true],
  ['150% scaling', 1280, 590, true], ['short laptop', 1366, 560, true], ['phone', 390, 844, true],
];

async function open(page, lang, width, height) {
  await page.setViewportSize({ width, height });
  await page.context().addCookies([{ name: 'carbonless_auth', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax' }]);
  await page.addInitScript(([token, l]) => {
    localStorage.setItem('_ca', token);
    localStorage.setItem('language', l);
    localStorage.setItem('language_explicit', '1');
  }, [MOCK_TOKEN, lang]);
  await page.route('http://localhost:8000/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/dashboard/select');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(T[lang].title);
}
const cards = (page) => page.locator('button', { has: page.locator('h2') });
// The cards react to hovering only once React has attached their handlers, so a hover that changes the border proves the
// page is interactive (a click before hydration would do nothing, as for any page).
async function interactive(page) {
  const first = cards(page).nth(0);
  await expect(async () => {
    await page.mouse.move(0, 0);                       // leave first: a pointer already resting on the card fires no new mouseenter
    await first.hover();
    await expect(first).toHaveCSS('border-top-color', 'rgb(42, 189, 65)', { timeout: 500 });
  }).toPass({ timeout: 15000 });
  await page.mouse.move(0, 0);
}

for (const lang of ['en', 'tr']) {
  test.describe(`mode selection (${lang})`, () => {
    for (const [name, w, h, fits] of SIZES) {
      test(`${name}: both cards and buttons are on screen, nothing overflows`, async ({ page }) => {
        await open(page, lang, w, h);
        const m = await page.evaluate(() => {
          const de = document.documentElement;
          const cs = [...document.querySelectorAll('button')].filter(b => b.querySelector('h2')).map(b => b.getBoundingClientRect());
          return { scrolls: de.scrollHeight > innerHeight + 1, overflowX: de.scrollWidth > innerWidth + 1,
            bottoms: cs.map(r => r.bottom), heights: cs.map(r => r.height), overlap: cs.length === 2 &&
              Math.min(cs[0].right, cs[1].right) - Math.max(cs[0].left, cs[1].left) > 2 &&
              Math.min(cs[0].bottom, cs[1].bottom) - Math.max(cs[0].top, cs[1].top) > 2 };
        });
        expect(m.overflowX).toBe(false);
        expect(m.overlap).toBe(false);
        expect(m.bottoms).toHaveLength(2);
        if (fits) {
          expect(m.scrolls).toBe(false);
          for (const b of m.bottoms) expect(b).toBeLessThanOrEqual(h);
        }
        if (w >= 640) expect(Math.abs(m.heights[0] - m.heights[1])).toBeLessThanOrEqual(1);      // side by side: equal cards
        await expect(page.getByText(T[lang].ai)).toBeVisible();
        await expect(page.getByText(T[lang].dash)).toBeVisible();
        await expect(page.getByRole('button', { name: lang === 'en' ? 'EN' : 'TR', exact: true })).toBeVisible();
      });
    }

    test('a screen that is genuinely too small scrolls instead of clipping (small phone)', async ({ page }) => {
      await open(page, lang, 360, 640);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      await page.getByText(T[lang].dash).scrollIntoViewIfNeeded();
      await expect(page.getByText(T[lang].dash)).toBeInViewport();
    });

    for (const [i, mode, tab] of [[0, 'ai', 'ai_carbon'], [1, 'dashboard', 'dashboard']]) {
      test(`${mode}: the whole card is clickable and sets the same startup values, then opens /dashboard`, async ({ page }) => {
        await open(page, lang, 1280, 590);
        await interactive(page);
        const box = await cards(page).nth(i).boundingBox();
        for (const [dx, dy] of [[box.width / 2, box.height / 2], [24, box.height - 20], [8, 8]]) {
          await page.goto('/dashboard/select');
          await interactive(page);
          await page.mouse.click(box.x + dx, box.y + dy);
          await page.waitForURL(/\/dashboard$/, { waitUntil: 'commit' });      // the redirect itself; the dashboard loading is not under test here
          expect(await page.evaluate(() => [localStorage.getItem('carbonless_startup_mode'), localStorage.getItem('carbonless_active_tab')])).toEqual([mode, tab]);
          expect((await page.context().cookies()).some(c => c.name === 'carbonless_mode_chosen')).toBe(true);
          await page.context().clearCookies({ name: 'carbonless_mode_chosen' });
          await page.context().addCookies([{ name: 'carbonless_auth', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax' }]);
        }
      });
    }
  });
}

test('the language toggle switches the page between English and Turkish', async ({ page }) => {
  await open(page, 'en', 1366, 768);
  await page.getByRole('button', { name: 'TR', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(T.tr.title);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(T.en.title);
});
