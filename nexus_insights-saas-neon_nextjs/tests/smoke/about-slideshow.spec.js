/**
 * Smoke test — About section: the phone's screens change by themselves.
 *
 * What it proves:
 *  - no click is needed: the four existing pictures (about-phone*.png) advance every ~3-4 s and loop
 *  - the phone frame stays put: every picture fills the same box, the arriving one fades in OVER the leaving one,
 *    which stays fully opaque underneath (so the identical frame is never dimmed)
 *  - it stops while the phone is off screen or the tab is hidden, and with reduced motion it does not advance
 *  - no layout shift; the optional dots still work; labels in English and Turkish
 */
import { test, expect } from '@playwright/test';

const SRCS = ['/about-phone.png', '/about-phone2.png', '/about-phone3.png', '/about-phone4.png'];

async function open(page, { lang = 'en', scroll = true } = {}) {
  await page.addInitScript(l => { localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1'); }, lang);
  await page.goto('/');
  await expect(page.getByTestId('phone-slideshow')).toBeAttached();
  if (scroll) await toPhone(page);
}
const toPhone = page => page.evaluate(() => document.querySelector('[data-testid="phone-slideshow"]').scrollIntoView({ block: 'center' }));
const activeIndex = page => page.evaluate(() => [...document.querySelectorAll('[data-testid="phone-slide"]')].findIndex(i => i.dataset.active === 'true'));

test.describe('phone slideshow (About)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('uses the four existing pictures and plays on its own, looping, without any click', async ({ page }) => {
    test.setTimeout(60_000);
    await open(page);
    const srcs = await page.evaluate(() => [...document.querySelectorAll('[data-testid="phone-slide"]')].map(i => new URL(i.src).pathname));
    expect(srcs).toEqual(SRCS);
    await expect(page.getByTestId('phone-slideshow')).toHaveAttribute('data-playing', 'true');

    // watch for ~19 s (one and a bit laps at 3.6 s) without touching anything
    const seen = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 19_000) {
      const i = await activeIndex(page);
      if (!seen.length || seen[seen.length - 1].i !== i) seen.push({ i, at: Date.now() - t0 });
      await page.waitForTimeout(150);
    }
    const order = seen.map(s => s.i);
    expect(order.slice(0, 5)).toEqual([order[0], (order[0] + 1) % 4, (order[0] + 2) % 4, (order[0] + 3) % 4, order[0]]);   // in order, all four, then round again
    // each picture stays about 3-4 s
    const gaps = seen.slice(1).map((s, k) => s.at - seen[k].at);
    for (const g of gaps) { expect(g).toBeGreaterThan(2800); expect(g).toBeLessThan(4600); }
  });

  test('only the screen changes: every picture fills the same box, the new one fades in over the old one, which is never dimmed', async ({ page }) => {
    test.setTimeout(30_000);
    await open(page);
    const boxes = await page.evaluate(() => [...document.querySelectorAll('[data-testid="phone-slide"]')].map(i => { const b = i.getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(v => Math.round(v * 10) / 10); }));
    for (const b of boxes) expect(b).toEqual(boxes[0]);                                // identical frame position in every picture
    const root = await page.getByTestId('phone-slideshow').boundingBox();
    expect(Math.abs(boxes[0][2] - root.width)).toBeLessThan(1); expect(Math.abs(boxes[0][3] - root.height)).toBeLessThan(1);

    // sample the crossfade: while the new picture is partly visible, the old one is still fully opaque beneath it
    const start = await activeIndex(page);
    let mid = null;
    for (let t = 0; t < 60 && !mid; t++) {
      mid = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('[data-testid="phone-slide"]')].map(i => ({ op: Number(getComputedStyle(i).opacity), z: Number(getComputedStyle(i).zIndex), active: i.dataset.active === 'true' }));
        const arriving = imgs.find(i => i.active);
        return arriving && arriving.op > 0.05 && arriving.op < 0.95 ? imgs : null;
      });
      if (!mid) await page.waitForTimeout(150);
    }
    expect(mid).not.toBeNull();
    const arriving = mid.find(i => i.active), leaving = mid.filter(i => !i.active && i.op > 0);
    expect(leaving).toHaveLength(1);
    expect(leaving[0].op).toBe(1);
    expect(arriving.z).toBeGreaterThan(leaving[0].z);
    expect(await activeIndex(page)).not.toBe(start);
    // a smooth fade, not a cut
    expect(await page.locator('[data-testid="phone-slide"][data-active="true"]').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0.9s');
  });

  test('pauses while the phone is off screen and while the tab is hidden, then carries on', async ({ page }) => {
    test.setTimeout(45_000);
    await open(page);
    await expect(page.getByTestId('phone-slideshow')).toHaveAttribute('data-playing', 'true');

    await page.evaluate(() => window.scrollTo(0, 0));                                  // phone out of view
    await expect(page.getByTestId('phone-slideshow')).toHaveAttribute('data-playing', 'false');
    await page.waitForTimeout(600);                                                    // let a running fade finish
    const held = await activeIndex(page);
    await page.waitForTimeout(5000);
    expect(await activeIndex(page)).toBe(held);

    await toPhone(page);                                                               // back: plays again
    await expect(page.getByTestId('phone-slideshow')).toHaveAttribute('data-playing', 'true');
    await expect.poll(() => activeIndex(page), { timeout: 8000 }).not.toBe(held);

    await page.evaluate(() => {                                                        // hidden tab
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByTestId('phone-slideshow')).toHaveAttribute('data-playing', 'false');
    await page.waitForTimeout(600);
    const held2 = await activeIndex(page);
    await page.waitForTimeout(5000);
    expect(await activeIndex(page)).toBe(held2);
  });

  test('reduced motion: no automatic change and no fade; the dots still switch pictures', async ({ page }) => {
    test.setTimeout(30_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(page.getByTestId('phone-slideshow')).toHaveAttribute('data-playing', 'false');
    expect(await activeIndex(page)).toBe(0);
    await page.waitForTimeout(5000);
    expect(await activeIndex(page)).toBe(0);
    await page.getByTestId('phone-dot').nth(2).click({ force: true });
    expect(await activeIndex(page)).toBe(2);
    expect(await page.locator('[data-testid="phone-slide"][data-active="true"]').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  });

  test('the optional dots work and are labelled; the phone does not react to a click on it', async ({ page }) => {
    await open(page);
    const dots = page.getByTestId('phone-dot');
    await expect(dots).toHaveCount(4);
    await expect(dots.nth(0)).toHaveAttribute('aria-label', 'Show image 1 of 4');
    await dots.nth(3).click({ force: true });
    expect(await activeIndex(page)).toBe(3);
    await expect(dots.nth(3)).toHaveAttribute('aria-current', 'true');
    const before = await activeIndex(page);
    await page.getByTestId('phone-slideshow').click({ position: { x: 60, y: 120 }, force: true });
    await page.waitForTimeout(300);
    expect(await activeIndex(page)).toBe(before);                                       // a click on the phone changes nothing
    await expect(page.getByTestId('phone-slideshow')).toHaveAttribute('aria-label', 'Carbon footprint on a phone');
  });

  test('Turkish labels', async ({ page }) => {
    await open(page, { lang: 'tr' });
    await expect(page.getByTestId('phone-slideshow')).toHaveAttribute('aria-label', 'Karbon ayak izi — telefonda');
    await expect(page.getByTestId('phone-dot').nth(1)).toHaveAttribute('aria-label', '2. görseli göster (4 görselden)');
  });

  test('no layout shift: the phone box, the page height and the CLS stay put while it plays', async ({ page }) => {
    test.setTimeout(40_000);
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    await open(page);
    await page.waitForTimeout(800);
    const size = () => page.evaluate(() => { const s = document.querySelector('[data-testid="phone-slideshow"]'); return [s.offsetWidth, s.offsetHeight, document.documentElement.scrollHeight]; });
    const first = await size();
    const cls0 = await page.evaluate(() => window.__cls);
    for (let i = 0; i < 4; i++) { await page.waitForTimeout(3800); expect(await size()).toEqual(first); }
    expect(first[0]).toBe(192); expect(first[1]).toBe(385);
    expect((await page.evaluate(() => window.__cls)) - cls0).toBeLessThan(0.005);
  });
});

test.describe('phone slideshow: every size', () => {
  const sizes = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 820, height: 1180 },
    { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1600, height: 900 }, { width: 1920, height: 1080 }];
  for (const s of sizes) {
    test(`${s.width}: plays by itself inside the card, no overflow`, async ({ page }) => {
      test.setTimeout(30_000);
      await page.setViewportSize(s);
      await open(page);
      const first = await activeIndex(page);
      await expect.poll(() => activeIndex(page), { timeout: 9000 }).not.toBe(first);
      const m = await page.evaluate(() => {
        const r = document.querySelector('[data-testid="phone-slideshow"]').getBoundingClientRect();
        return { x: r.x, r: r.right, w: document.querySelector('[data-testid="phone-slideshow"]').offsetWidth, h: document.querySelector('[data-testid="phone-slideshow"]').offsetHeight,
                 overflowX: document.documentElement.scrollWidth - innerWidth, viewW: document.documentElement.clientWidth };
      });
      expect(m.overflowX).toBeLessThanOrEqual(0);
      expect(m.x).toBeGreaterThanOrEqual(-8); expect(m.r).toBeLessThanOrEqual(m.viewW + 8);     // (the card is tilted 6 degrees)
      expect(m.h).toBe(s.width >= 640 ? 385 : 280);                                                 // the existing heights, unchanged
      expect(m.w).toBeGreaterThan(100); expect(m.w).toBeLessThanOrEqual(s.width >= 640 ? 192 : 154);   // (the card may narrow it on small screens, as before)
    });
  }
});
