/**
 * Smoke test — About section: the smaller phone and its composition.
 * The phone box is 12.5% smaller than before (was 176x320 below 640px and 220x440 from 640px; now 154x280 / 192x385),
 * with the same two shapes, centred on the green stripe, clear of the "Hey!" text, inside the card, no overflow.
 */
import { test, expect } from '@playwright/test';

const sizes = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];

for (const lang of ['en', 'tr']) {
  for (const s of sizes) {
    test(`${lang} ${s.width}: ~12% smaller phone, same shape, on its stripe, clear of the text, nothing clipped`, async ({ page }) => {
      await page.setViewportSize(s);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(l => { localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1'); }, lang);
      await page.goto('/');
      await page.evaluate(() => document.querySelector('[data-testid="phone-slideshow"]').scrollIntoView({ block: 'center' }));
      const g = await page.evaluate(() => {
        const r = el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
        const phone = document.querySelector('[data-testid="phone-slideshow"]');
        const card = [...document.querySelectorAll('div')].find(e => e.contains(phone) && e.className.includes('rounded-[2rem]') && e.className.includes('border'));
        const stripe = card.querySelector('[class*="rounded-b-"]');
        const hey = [...card.querySelectorAll('p')].find(p => /Hey|Bugünkü/.test(p.textContent));
        const range = document.createRange(); range.selectNodeContents(hey.parentElement);
        // the phone is tilted: compare the text with its real (rotated) outline, not its bounding box
        const tilt = phone.parentElement, m = new DOMMatrix(getComputedStyle(tilt).transform), ang = Math.atan2(m.b, m.a);
        const tb = tilt.getBoundingClientRect(), c = { x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 };
        const lines = [...hey.parentElement.querySelectorAll('p')].flatMap(p => { const g = document.createRange(); g.selectNodeContents(p); return [...g.getClientRects()]; }).filter(q => q.width > 1 && q.height > 1);   // each line of text, not the block around them
        const inside = (x, y, pad) => { const dx = x - c.x, dy = y - c.y; const u = dx * Math.cos(-ang) - dy * Math.sin(-ang), v = dx * Math.sin(-ang) + dy * Math.cos(-ang); return Math.abs(u) < tilt.offsetWidth / 2 + pad && Math.abs(v) < tilt.offsetHeight / 2 + pad; };
        const pts = []; for (const rb of lines) for (let i = 0; i <= 8; i++) for (let j = 0; j <= 2; j++) pts.push([rb.x + rb.width * i / 8, rb.y + rb.height * j / 2]);
        const touching = pts.filter(([x, y]) => inside(x, y, 4)).length;
        return { touching, phone: r(phone), box: { w: phone.offsetWidth, h: phone.offsetHeight }, card: r(card), stripe: r(stripe), text: r(range),
                 overflowX: document.documentElement.scrollWidth - innerWidth };
      });
      const wide = s.width >= 640;
      expect(g.box.h).toBe(wide ? 385 : 280);                                                 // was 440 / 320
      expect(g.box.h).toBeLessThan((wide ? 440 : 320) * 0.9);
      expect(g.box.w / g.box.h).toBeGreaterThan(wide ? 0.49 : 0.545);                          // the same shapes as before (0.50 / 0.55)
      expect(g.box.w / g.box.h).toBeLessThan(wide ? 0.51 : 0.56);
      const cx = g.phone.x + g.phone.w / 2, sx = g.stripe.x + g.stripe.w / 2;
      expect(Math.abs(cx - sx)).toBeLessThan(18);                                              // centred on the green stripe
      expect(g.phone.x).toBeGreaterThanOrEqual(g.card.x); expect(g.phone.r).toBeLessThanOrEqual(g.card.r);
      expect(g.phone.y).toBeGreaterThanOrEqual(g.card.y); expect(g.phone.b).toBeLessThanOrEqual(g.card.b);
      expect(g.touching).toBe(0);                                                              // the text does not touch the phone's outline
      expect(g.text.x).toBeGreaterThanOrEqual(g.card.x);
      expect(g.overflowX).toBeLessThanOrEqual(0);
    });
  }
}
