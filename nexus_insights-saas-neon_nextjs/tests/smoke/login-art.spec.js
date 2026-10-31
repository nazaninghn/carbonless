/**
 * Smoke test — Login page: public/loginnew.png and the brand tagline under it.
 *
 *  - loginnew.png (1122x1402, transparent) replaces login-bg.png: undistorted, nothing visible cropped, centred; the old picture is not loaded
 *  - the tagline sits directly under the picture, centred, in the Carbonless deep green (#175022) in an italic serif (Cormorant Garamond),
 *    English and Turkish, wrapping naturally, never overflowing
 *  - desktop (1024+): the picture is in the right column; below that it follows the form; exactly one is visible at any width
 *  - the form is untouched (fields, button, links)
 */
import { test, expect } from '@playwright/test';

const sizes = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];
const TAG = { en: 'Every footprint we measure is a step toward a greener tomorrow.', tr: 'Ölçtüğümüz her ayak izi, daha yeşil bir yarına atılmış bir adımdır.' };

for (const lang of ['en', 'tr']) {
  for (const s of sizes) {
    test(`${lang} ${s.width}: loginnew.png with the tagline under it, in place, nothing overflows`, async ({ page }) => {
      const requested = [];
      page.on('request', r => requested.push(decodeURIComponent(new URL(r.url()).pathname + new URL(r.url()).search)));
      await page.setViewportSize(s);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(l => { localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1'); }, lang);
      await page.goto('/login');
      await expect(page.locator('#login-email')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);

      const g = await page.evaluate(() => {
        const r = el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
        const arts = [...document.querySelectorAll('[data-testid="login-art"]')].filter(a => a.getBoundingClientRect().width > 0);
        const a = arts[0];
        const img = a.querySelector('img'), box = a.querySelector('[data-testid="login-art-box"]'), tag = a.querySelector('[data-testid="login-tagline"]');
        const cs = getComputedStyle(tag);
        const range = document.createRange(); range.selectNodeContents(tag);
        return {
          visible: arts.length, src: decodeURIComponent(img.currentSrc || img.src), nw: img.naturalWidth, nh: img.naturalHeight, img: r(img), box: r(box), tag: r(tag), art: r(a),
          lines: [...range.getClientRects()].length, family: cs.fontFamily, style: cs.fontStyle, color: cs.color, size: parseFloat(cs.fontSize), align: cs.textAlign, text: tag.textContent,
          form: r(document.querySelector('#login-email')), password: !!document.querySelector('#login-password'), submit: !!document.querySelector('form button[type="submit"]'),
          forgot: !!document.querySelector('a[href="/forgot-password"]'), register: !!document.querySelector('a[href="/register"]'),
          overflowX: document.documentElement.scrollWidth - innerWidth, viewW: document.documentElement.clientWidth,
          imgCount: document.querySelectorAll('main img[src*="loginnew"]').length,
        };
      });
      // the picture: the new asset, whole, undistorted
      expect(g.visible).toBe(1);
      expect(g.src).toContain('loginnew.png'); expect([g.nw, g.nh]).toEqual([1122, 1402]);
      expect(Math.abs(g.img.w / g.img.h - 1122 / 1402)).toBeLessThan(0.01);                 // natural proportions
      expect(Math.abs(g.box.w / g.box.h - 820 / 1050)).toBeLessThan(0.01);
      const k = g.img.w / 1122;
      expect(g.img.x + 187 * k).toBeGreaterThanOrEqual(g.box.x - 0.5); expect(g.img.x + 974 * k).toBeLessThanOrEqual(g.box.r + 0.5);   // the visible art (x 187-974) is inside its box
      expect(g.img.y + 225 * k).toBeGreaterThanOrEqual(g.box.y - 0.5); expect(g.img.y + 1237 * k).toBeLessThanOrEqual(g.box.b + 0.5);  // ...and y 225-1237
      expect(requested.filter(u => /login-bg/.test(u))).toEqual([]);                          // the old picture is not used
      expect(g.imgCount).toBe(2);                                                              // (the other copy, hidden at this width, is lazy and not loaded)
      // placement and balance
      expect(g.art.x).toBeGreaterThanOrEqual(0); expect(g.art.r).toBeLessThanOrEqual(g.viewW);
      const dx = (g.box.x + g.box.r) / 2 - (g.tag.x + g.tag.r) / 2;                           // how far left of the picture's centre line the tagline sits
      if (s.width >= 1024) { expect(dx).toBeGreaterThanOrEqual(s.width >= 1280 ? 50 : 36); expect(dx).toBeLessThanOrEqual(60); }   // a little to the left, toward the form
      else expect(Math.abs(dx)).toBeLessThan(4);                                              // phones / tablets: centred under the picture
      expect(g.tag.y).toBeGreaterThanOrEqual(g.box.b);                                        // the tagline is directly below the picture
      expect(g.tag.y - g.box.b).toBeLessThan(60);
      if (s.width >= 1024) { expect(g.box.x).toBeGreaterThan(g.form.r); expect(g.box.w).toBeLessThanOrEqual(416.5); expect(g.tag.x).toBeGreaterThan(g.form.r + 24); expect(g.lines).toBe(s.width >= 1280 && lang === 'en' ? 2 : g.lines); }   // clear of the form; two lines on a wide English layout   // right column, beside the form
      else { expect(g.box.y).toBeGreaterThan(g.form.b); expect(g.box.w).toBeLessThanOrEqual(240.5); }                    // under the form
      // the tagline: words, face, colour, centring, wrapping
      expect(g.text).toBe(TAG[lang]);
      expect(g.family).toContain('Cormorant Garamond'); expect(g.style).toBe('italic');
      expect(g.color).toBe('rgb(23, 80, 34)'); expect(g.align).toBe('center' === g.align ? 'center' : g.align);
      expect(g.size).toBeGreaterThanOrEqual(22); expect(g.size).toBeLessThanOrEqual(30);
      expect(g.lines).toBeGreaterThanOrEqual(2); expect(g.lines).toBeLessThanOrEqual(4);      // wraps naturally, never one long line or a ragged column
      expect(g.tag.x).toBeGreaterThanOrEqual(0); expect(g.tag.r).toBeLessThanOrEqual(g.viewW);
      expect(g.overflowX).toBeLessThanOrEqual(0);
      // the form is unchanged
      expect(g.password && g.submit && g.forgot && g.register).toBe(true);
    });
  }
}

test('the tagline font is really Cormorant Garamond (loaded), not a fallback', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await expect(page.locator('#login-email')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => [...document.fonts].filter(f => f.family.includes('Cormorant') && f.status === 'loaded').length);
  expect(loaded).toBeGreaterThan(0);
});
