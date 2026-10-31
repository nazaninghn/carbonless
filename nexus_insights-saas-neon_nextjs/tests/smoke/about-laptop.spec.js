/**
 * Smoke test — AI section: the laptop opens once, slowly, on its hinge.
 *
 * public/ai-laptop.png is drawn as a still BASE (the deck) and a LID that swings about the hinge with perspective.
 * It opens the first time the laptop is mostly in view (not before), over ~1.8 s, stays open, and never replays;
 * with reduced motion it is simply shown open.
 */
import { test, expect } from '@playwright/test';

async function open(page, lang = 'en') {
  await page.addInitScript(l => { localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1'); }, lang);
  await page.goto('/');
  await expect(page.getByTestId('laptop')).toBeAttached();
}
const toLaptop = page => page.evaluate(() => document.querySelector('[data-testid="laptop"]').scrollIntoView({ block: 'center' }));
/** the lid's opening angle in degrees (0 = fully open) */
const lidAngle = page => page.evaluate(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('[data-testid="laptop-lid"]')).transform); return Math.abs(Math.atan2(m.m23, m.m22) * 180 / Math.PI); });

test.describe('laptop opening', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('is the existing ai-laptop.png, split into a still deck and a hinged lid, with perspective', async ({ page }) => {
    await open(page);
    const info = await page.evaluate(() => {
      const lid = document.querySelector('[data-testid="laptop-lid"]'), base = document.querySelector('[data-testid="laptop-base"]');
      return {
        baseSrc: decodeURIComponent(base.currentSrc), lidSrc: decodeURIComponent(lid.querySelector('img').currentSrc),
        perspective: getComputedStyle(lid.parentElement).perspective, origin: getComputedStyle(lid).transformOrigin, h: lid.offsetHeight,
        baseTransform: getComputedStyle(base).transform, imgs: document.querySelectorAll('[data-testid="laptop"] img').length,
      };
    });
    expect(info.baseSrc).toContain('ai-laptop.png'); expect(info.lidSrc).toContain('ai-laptop.png');
    expect(info.imgs).toBe(2);
    expect(parseFloat(info.perspective)).toBeGreaterThan(1000);
    expect(info.baseTransform).toBe('none');
    const oy = parseFloat(info.origin.split(' ')[1]);
    expect(oy / info.h).toBeGreaterThan(0.78); expect(oy / info.h).toBeLessThan(0.82);   // hinged at the deck's top edge
    await expect(page.getByTestId('laptop-base')).toHaveAttribute('alt', 'Carbonless AI chat on a MacBook');
  });

  test('stays closed until it scrolls into view, then opens slowly and smoothly, once', async ({ page }) => {
    test.setTimeout(40_000);
    await open(page);
    // far below the fold: nothing opens it early
    await page.waitForTimeout(2500);
    await expect(page.getByTestId('laptop')).toHaveAttribute('data-open', 'false');
    expect(await lidAngle(page)).toBeGreaterThan(60);

    await toLaptop(page);
    const t0 = Date.now(); const samples = [];
    while (Date.now() - t0 < 3200) { samples.push({ t: Date.now() - t0, a: await lidAngle(page) }); await page.waitForTimeout(40); }
    const start = samples.find(s => s.a < 66);                              // first sign of movement
    expect(start).toBeTruthy();
    const end = samples.find(s => s.a < 0.5);
    expect(end).toBeTruthy();
    const dur = end.t - start.t;
    expect(dur).toBeGreaterThan(1200); expect(dur).toBeLessThan(2600);       // ~1.8 s: slow, not a snap
    // monotonic (never closes again, never overshoots) and no big jump between frames
    for (let i = 1; i < samples.length; i++) { expect(samples[i].a).toBeLessThanOrEqual(samples[i - 1].a + 0.2); expect(samples[i - 1].a - samples[i].a).toBeLessThan(14); }
    expect(await page.getByTestId('laptop-lid').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('1.8s');
    expect(await page.getByTestId('laptop-lid').evaluate(el => getComputedStyle(el).transitionTimingFunction)).toContain('cubic-bezier');
    expect(samples[0].a).toBeLessThan(75);                                   // starts nearly closed, not edge-on
    expect(samples[0].a).toBeGreaterThan(40);

    // never replays: away and back, it is open and nothing is running
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await toLaptop(page);
    await page.waitForTimeout(300);
    expect(await lidAngle(page)).toBeLessThan(0.5);
    expect(await page.evaluate(() => document.querySelector('[data-testid="laptop-lid"]').getAnimations().length)).toBe(0);
    await expect(page.getByTestId('laptop')).toHaveAttribute('data-open', 'true');
  });

  test('reduced motion: shown open at once, no transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(page.getByTestId('laptop')).toHaveAttribute('data-open', 'true');
    expect(await lidAngle(page)).toBeLessThan(0.5);
    expect(await page.getByTestId('laptop-lid').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  });
});

test.describe('laptop at every size, in both languages', () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });
  const sizes = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];
  for (const lang of ['en', 'tr']) {
    for (const s of sizes) {
      test(`${lang} ${s.width}: open, whole, inside the window, no overflow`, async ({ page }) => {
        await page.setViewportSize(s);
        await open(page, lang);
        await toLaptop(page);
        await expect(page.getByTestId('laptop')).toHaveAttribute('data-open', 'true');
        const g = await page.evaluate(() => {
          const r = el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
          return { box: r(document.querySelector('[data-testid="laptop"]')), base: r(document.querySelector('[data-testid="laptop-base"]')), lid: r(document.querySelector('[data-testid="laptop-lid"]')),
                   overflowX: document.documentElement.scrollWidth - innerWidth, viewW: document.documentElement.clientWidth, alt: document.querySelector('[data-testid="laptop-base"]').alt };
        });
        expect(g.overflowX).toBeLessThanOrEqual(0);
        expect(g.box.x).toBeGreaterThanOrEqual(0); expect(g.box.r).toBeLessThanOrEqual(g.viewW);
        expect(Math.abs(g.box.w / g.box.h - 1402 / 1122)).toBeLessThan(0.02);          // the picture's own proportions
        expect(Math.abs(g.lid.w - g.base.w)).toBeLessThan(1); expect(Math.abs(g.lid.h - g.base.h)).toBeLessThan(1);   // lid and deck coincide when open
        expect(g.alt).toBe(lang === 'tr' ? 'Carbonless AI sohbet ekranı — MacBook üzerinde' : 'Carbonless AI chat on a MacBook');
      });
    }
  }
});
