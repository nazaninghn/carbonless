/**
 * Smoke test — Our Mission (/about): public/aboutNEWW.png, and only there.
 *
 *  - aboutNEWW.png (1024x1024, transparent, art x 85-1023, y 0-978) is the Our Mission picture: undistorted, nothing visible cropped, beside the
 *    text (or under it), inside the window; it is on no other page or section, and eco.png / about-img.png are not on /about
 *  - it fades in and rises once as the section shows, then floats; pauses off screen / in a hidden tab; reduced motion = still
 */
import { test, expect } from '@playwright/test';

async function open(page, path = '/about', lang = 'en') {
  await page.addInitScript(l => { localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1'); }, lang);
  await page.goto(path);
}
const rectOf = (page, sel) => page.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; }, sel);

test.describe('Our Mission picture', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('is aboutNEWW.png, undistorted, with all of its visible art inside the box', async ({ page }) => {
    const requested = [];
    page.on('request', r => requested.push(decodeURIComponent(new URL(r.url()).pathname)));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(page.getByTestId('mission-visual')).toHaveAttribute('data-shown', 'true');
    const m = await page.evaluate(() => {
      const img = document.querySelector('[data-testid="mission-visual-img"]'), box = document.querySelector('[data-testid="mission-visual"]');
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, x1 = -1, clear = 0;
      for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x++) { const a = d[(y * c.width + x) * 4 + 3]; if (a === 0) clear++; if (a > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } }
      const ib = img.getBoundingClientRect(), bb = box.getBoundingClientRect();
      return { src: decodeURIComponent(img.currentSrc), nw: img.naturalWidth, nh: img.naturalHeight, w: ib.width, h: ib.height, x: ib.x, bx: bb.x, br: bb.right, bw: bb.width, bh: bb.height, x0, x1, clear: clear / (c.width * c.height / 2), alt: img.alt };
    });
    expect(m.src).toContain('aboutNEWW.png');
    expect([m.nw, m.nh]).toEqual([1024, 1024]);
    expect(m.clear).toBeGreaterThan(0.3);
    expect(m.x0).toBeGreaterThan(75); expect(m.x0).toBeLessThan(95);                    // the picture has a small empty margin at the left (art x 85-1023); the box shows the whole canvas
    expect(Math.abs(m.w / m.h - 1)).toBeLessThan(0.01);                         // natural proportions
    const k = m.w / 1024;
    expect(m.x + m.x0 * k).toBeGreaterThanOrEqual(m.bx - 0.5);                           // all visible art starts inside the box
    expect(m.x + m.x1 * k).toBeLessThanOrEqual(m.br + 0.5);                              // ...and ends inside it
    expect(Math.abs(m.bw / m.bh - 1)).toBeLessThan(0.01);                                // a square box: the whole 1024 x 1024 canvas
    expect(m.alt).toBe('A green industrial site with trees growing from its chimneys, wrapped in a flow of green energy');
    expect(requested.filter(u => /about-img|eco\.png|aboutNEW\.png/.test(u))).toEqual([]); // the earlier Mission pictures (about-img.png, aboutNEW.png) and the AI picture are not used here
    expect(await page.locator('main img').count()).toBe(1);
  });

  test('appears ONLY on /about: not on the landing page (Hero, About, AI, Pricing, FAQ) nor on /ai', async ({ page }) => {
    for (const path of ['/', '/ai']) {
      const requested = [];
      const onReq = r => requested.push(decodeURIComponent(new URL(r.url()).pathname));
      page.on('request', onReq);
      await open(page, path);
      await page.evaluate(() => window.scrollTo({ top: 99999, behavior: 'instant' }));
      await page.waitForTimeout(1500);
      expect(await page.locator('img[src*="aboutNEW"], [data-testid="mission-visual"]').count(), path).toBe(0);
      expect(requested.filter(u => /aboutNEW/.test(u)), path).toEqual([]);
      page.off('request', onReq);
    }
  });

  test('beside the text on desktop, under it on phones; centred on the text vertically; inside the window', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const pic = await rectOf(page, '[data-testid="mission-visual"]');
    const text = await page.evaluate(() => { const b = document.querySelector('main section:first-of-type .grid > div:first-child').getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom }; });
    expect(pic.x).toBeGreaterThan(text.r - 4);
    expect(Math.abs((pic.y + pic.b) / 2 - (text.y + text.b) / 2)).toBeLessThan(70);
    expect(pic.w).toBeGreaterThan(440); expect(pic.w).toBeLessThan(620);
  });

  test('enters once (fades in and rises a few px), then floats gently; pauses off screen and in a hidden tab', async ({ page }) => {
    test.setTimeout(40_000);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      window.__m = [];
      const tick = () => { const e = document.querySelector('[data-testid="mission-visual"] .eco-in'); if (e) { const cs = getComputedStyle(e); window.__m.push([Number(cs.opacity), new DOMMatrix(cs.transform).m42]); } requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await open(page);
    await expect(page.getByTestId('mission-visual')).toHaveAttribute('data-shown', 'true');
    await page.waitForTimeout(1800);
    const s = await page.evaluate(() => window.__m);
    expect(s[0][0]).toBeLessThan(0.2); expect(s[0][1]).toBeGreaterThan(8);
    expect(s.find(v => v[0] > 0.1 && v[0] < 0.9)).toBeTruthy();
    const last = s[s.length - 1]; expect(last[0]).toBe(1); expect(Math.abs(last[1])).toBeLessThan(0.5);
    expect(Math.max(...s.map(v => v[1]))).toBeLessThanOrEqual(24);
    // floats a few pixels
    const ys = [];
    for (let i = 0; i < 5; i++) { ys.push(await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('[data-testid="mission-visual"] .eco-float')).transform).m42)); await page.waitForTimeout(700); }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.2); expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(10);
    await expect(page.getByTestId('mission-visual')).toHaveAttribute('data-ambient', 'running');
    // pauses
    await page.evaluate(() => window.scrollTo({ top: 99999, behavior: 'instant' }));
    await expect(page.getByTestId('mission-visual')).toHaveAttribute('data-ambient', 'paused');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(page.getByTestId('mission-visual')).toHaveAttribute('data-ambient', 'running');
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(page.getByTestId('mission-visual')).toHaveAttribute('data-ambient', 'paused');
  });

  test('reduced motion: shown at once, still', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(page.getByTestId('mission-visual')).toHaveAttribute('data-shown', 'true');
    const v = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('[data-testid="mission-visual"] .eco-in')); return [Number(cs.opacity), cs.transform, cs.transitionDuration, document.getAnimations().filter(a => a.effect?.target?.closest?.('[data-testid="mission-visual"]')).length]; });
    expect(v[0]).toBe(1); expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(v[1]); expect(v[2]).toBe('0s'); expect(v[3]).toBe(0);
  });
});

test.describe('Our Mission picture at every size, in both languages', () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });
  const sizes = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 820, height: 1180 }, { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];
  for (const lang of ['en', 'tr']) {
    for (const s of sizes) {
      test(`${lang} ${s.width}: in place, whole, clear of the text, no overflow`, async ({ page }) => {
        await page.setViewportSize(s);
        await open(page, '/about', lang);
        await expect(page.getByTestId('mission-visual')).toHaveAttribute('data-shown', 'true');
        const pic = await rectOf(page, '[data-testid="mission-visual"]');
        const text = await page.evaluate(() => { const b = document.querySelector('main section:first-of-type .grid > div:first-child').getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom }; });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
        expect(pic.x).toBeGreaterThanOrEqual(0); expect(pic.r).toBeLessThanOrEqual(s.width);
        expect(Math.abs(pic.w / pic.h - 1)).toBeLessThan(0.02);
        expect(pic.w).toBeGreaterThan(Math.min(300, s.width * 0.75));
        if (s.width >= 1024) expect(pic.x).toBeGreaterThan(text.r - 4); else expect(pic.y).toBeGreaterThan(text.b - 4);
        expect(await page.locator('[data-testid="mission-visual"]').count()).toBe(1);
        expect(await page.getByTestId('mission-visual-img').getAttribute('alt')).toBe(lang === 'tr' ? 'Yeşil bir tesis: bacalardan ağaçlar büyüyor, çevresinde yeşil bir enerji akışı' : 'A green industrial site with trees growing from its chimneys, wrapped in a flow of green energy');
        expect((await page.locator('main h1').innerText()).trim()).toBe(lang === 'tr' ? 'Misyonumuz' : 'Our Mission');
      });
    }
  }
});
