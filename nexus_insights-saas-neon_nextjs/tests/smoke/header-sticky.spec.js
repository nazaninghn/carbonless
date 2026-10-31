/**
 * Smoke test — the main navigation (floating pill Header) follows the page.
 *
 * It was `position: sticky` but never stuck: `overflow-x: hidden` on <body> and on each page wrapper made them scroll containers,
 * which disables sticky for everything inside. They are now `overflow-x: clip`. This proves, on every page that uses the Header
 * (landing, About, AI, Features, Contact), on desktop and phone:
 *  - the pill stays at the top while scrolling down and up, and is above the content
 *  - nothing between it and <body> can break sticky again (no scroll container, no transform / filter / contain)
 *  - it does not cover headings at the top of the page or anchored sections after a nav jump
 *  - a touch more shadow / border once scrolled; no layout shift, no horizontal overflow
 *  - the mobile menu still opens below it, works while scrolled, and closes with Escape
 */
import { test, expect } from '@playwright/test';

const pages = ['/', '/about', '/ai', '/features', '/contact'];
const viewports = [{ name: 'desktop 1440', width: 1440, height: 900 }, { name: 'laptop 1024', width: 1024, height: 768 }, { name: 'phone 390', width: 390, height: 844 }, { name: 'phone 360', width: 360, height: 740 }];

const pill = page => page.locator('header nav').first();
const rect = async loc => loc.evaluate(el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; });
const scrollTo = async (page, y) => { await page.evaluate(v => window.scrollTo({ top: v, behavior: 'instant' }), y); await page.waitForTimeout(250); };

for (const vp of viewports) {
  for (const path of pages) {
    test(`${vp.name} ${path}: the Header stays at the top while scrolling down and up`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      await expect(pill(page)).toBeVisible();
      const home = await rect(pill(page));
      const header = page.locator('header').first();
      expect(await header.evaluate(el => getComputedStyle(el).position)).toBe('sticky');
      expect(await header.evaluate(el => getComputedStyle(el).zIndex)).toBe('50');

      // nothing around it can disable sticky: no scroll container / transform / filter / contain between it and <body>
      const blockers = await header.evaluate(el => {
        const bad = [];
        for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
          const cs = getComputedStyle(e);
          const scrolls = [cs.overflowX, cs.overflowY].some(o => ['hidden', 'auto', 'scroll'].includes(o));
          if (e !== document.body && scrolls || e === document.body && scrolls) bad.push(`${e.tagName} overflow ${cs.overflowX}/${cs.overflowY}`);
          if (cs.transform !== 'none' || cs.filter !== 'none' || (cs.contain && cs.contain !== 'none') || cs.perspective !== 'none') bad.push(`${e.tagName} transform/filter/contain`);
        }
        return bad;
      });
      expect(blockers).toEqual([]);

      // the first heading is below the Header at the top of the page (the Header is in the flow, so it never covers it)
      const h = await page.locator('main h1, main h2, h1').first().evaluate(el => el.getBoundingClientRect().top);
      expect(h).toBeGreaterThanOrEqual(home.b - 1);
      await expect(pill(page)).toHaveAttribute('data-scrolled', 'false');

      const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      for (const y of [400, Math.min(1200, total), Math.floor(total / 2), total, Math.floor(total / 3), 400, 0]) {
        await scrollTo(page, y);
        const r = await rect(pill(page));
        expect(Math.abs(r.y - home.y), `scrollY ${y}`).toBeLessThanOrEqual(1);                      // exactly where it was: no drift, no jump
        expect(r.w).toBeCloseTo(home.w, 0); expect(r.h).toBeCloseTo(home.h, 0);                      // same size
        // it is above the page content: the element at its centre belongs to the pill
        expect(await page.evaluate(([x, yy]) => !!document.elementFromPoint(x, yy)?.closest('header nav'), [r.x + r.w / 2, r.y + r.h / 2]), `above content at ${y}`).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      }
      await scrollTo(page, 600);
      await expect(pill(page)).toHaveAttribute('data-scrolled', 'true');
      const shadow = await pill(page).evaluate(el => [getComputedStyle(el).boxShadow, getComputedStyle(el).backgroundColor, getComputedStyle(el).backdropFilter]);
      expect(shadow[0]).toContain('0.16');                                                         // the stronger shadow once scrolled
      // a soft blur behind the pill from 1024px up (the project switches backdrop-filter off below that: see the Android flicker fix in
      // globals.css); on phones the pill stays 90%+ white, so it is readable over any content either way
      if (vp.width >= 1024) expect(shadow[2]).toContain('blur');
      else { expect(shadow[2]).toBe('none'); expect(Number(String(shadow[1]).match(/([\d.]+)\)$/)?.[1] ?? 1)).toBeGreaterThanOrEqual(0.9); }   // (the alpha of the pill's background)
      await scrollTo(page, 0);
      await expect(pill(page)).toHaveAttribute('data-scrolled', 'false');
    });
  }
}

test.describe('Header: the rest of the behaviour', () => {
  test('the landing page FAQ link jumps to its section without hiding the heading behind the Header; About goes to its page and the Header is there too', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(pill(page)).toBeVisible();
    // (About and AI are their own pages; FAQ is the in-page anchor)
    for (const [name, id] of [['FAQ', 'faq']]) {
      await pill(page).getByRole('link', { name, exact: true }).click();
      await page.waitForTimeout(1500);                                                       // (smooth scroll)
      const hb = (await rect(pill(page))).b;
      const top = await page.locator(`#${id} h2`).evaluate(el => el.getBoundingClientRect().top);
      expect(top, `${id} heading`).toBeGreaterThanOrEqual(hb);                               // below the Header
      expect(top).toBeLessThan(260);                                                         // and near the top, so the jump worked
      expect(Math.abs((await rect(pill(page))).y - 16)).toBeLessThanOrEqual(1);              // the pill is still in place
    }
    await pill(page).getByRole('link', { name: 'About', exact: true }).click();
    await expect(page).toHaveURL(/\/about/, { timeout: 30_000 });
    await expect(pill(page)).toBeVisible();
    expect((await rect(pill(page))).y).toBeGreaterThanOrEqual(0);
  });

  test('phone: the menu opens under the Header while scrolled, lists every link, closes with Escape and on an outside tap', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/about');
    await scrollTo(page, 500);
    const btn = page.getByRole('button', { name: 'Open menu' });
    await btn.click();
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    const menu = page.locator('header nav > div.absolute');
    await expect(menu).toBeVisible();
    const mr = await rect(menu), pr = await rect(pill(page));
    expect(mr.y).toBeGreaterThanOrEqual(pr.b);                                                // hangs below the pill
    expect(mr.x).toBeGreaterThanOrEqual(0); expect(mr.r).toBeLessThanOrEqual(390); expect(mr.b).toBeLessThanOrEqual(844);
    expect(await menu.locator('a').count()).toBeGreaterThanOrEqual(5);
    expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('header nav'), [mr.x + mr.w / 2, mr.y + mr.h / 2])).toBe(true);   // above the page content
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await btn.click();
    await expect(menu).toBeVisible();
    await page.mouse.click(200, 700);                                                         // outside
    await expect(menu).toHaveCount(0);
    // scrolling with the menu closed: the pill is still pinned
    await scrollTo(page, 900);
    expect(Math.abs((await rect(pill(page))).y - 16)).toBeLessThanOrEqual(1);
  });

  test('the language switch still works while scrolled', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => { localStorage.setItem('language', 'en'); localStorage.setItem('language_explicit', '1'); });
    await page.goto('/ai');
    await scrollTo(page, 700);
    await pill(page).getByRole('button', { name: 'Türkçeye geç' }).click();
    await expect(pill(page).getByRole('link', { name: 'Giriş Yap' })).toBeVisible();
    expect(Math.abs((await rect(pill(page))).y - 16)).toBeLessThanOrEqual(1);
  });

  test('the enlarged Earth and the Scope popover sit correctly with a pinned Header', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByTestId('hero-earth-btn').click();
    await expect(page.getByTestId('hero-earth')).toHaveAttribute('data-zoomed', 'true');
    // the enlargement is in place (no overlay): the Header stays on top, uncovered, and the Earth stays below it
    expect(await page.evaluate(() => { const b = document.querySelector('header nav').getBoundingClientRect(); return !!document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest('header'); })).toBe(true);
    expect((await rect(page.getByTestId('hero-earth'))).y).toBeGreaterThanOrEqual((await rect(pill(page))).b);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('hero-earth')).toHaveAttribute('data-zoomed', 'false');
    await page.getByTestId('hero-scope-s2').locator('button.hero-card').click({ force: true });
    await expect(page.getByTestId('hero-scope-pop-s2')).toBeVisible();
    const hb = (await rect(pill(page))).b;
    expect((await rect(page.getByTestId('hero-scope-pop-s2'))).y).toBeGreaterThanOrEqual(hb - 1);   // the popover is kept clear of the pill
  });
});
