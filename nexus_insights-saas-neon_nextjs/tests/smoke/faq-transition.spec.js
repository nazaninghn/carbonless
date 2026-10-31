/**
 * Smoke test — landing page: Pricing flows into the FAQ with no line between them.
 *
 * Pricing is white; the FAQ is the pale brand green (#F1FCF2), but its background eases in from white over its first ~8rem (three
 * stops), so there is no hard colour step. Checked on real screenshot pixels down a strip at the page margin: no step between
 * neighbouring rows anywhere across the seam, white right above it, the pale green well below it. Content, cards and the FAQ's
 * accordion are unchanged.
 */
import { test, expect } from '@playwright/test';
import sharp from 'sharp';

const sizes = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];

for (const lang of ['en', 'tr']) {
  for (const s of sizes) {
    test(`${lang} ${s.width}: Pricing -> FAQ is a soft gradient, no line, content intact`, async ({ page }) => {
      await page.setViewportSize(s);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(l => { localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1'); }, lang);
      await page.goto('/');
      await expect(page.locator('#faq')).toBeAttached();
      await expect(page.locator('html')).toHaveAttribute('lang', lang);                               // the page is server-rendered in English, then switches to the chosen language
      const g = await page.evaluate(() => {
        const cs = id => getComputedStyle(document.getElementById(id));
        const pr = document.getElementById('pricing'), f = document.getElementById('faq');
        return {
          prBg: cs('pricing').backgroundColor, prImg: cs('pricing').backgroundImage, faqImg: cs('faq').backgroundImage, faqBg: cs('faq').backgroundColor,
          borders: [cs('faq').borderTopWidth, cs('faq').borderBottomWidth, cs('pricing').borderBottomWidth], shadows: [cs('faq').boxShadow, cs('pricing').boxShadow],
          before: getComputedStyle(f, '::before').content, after: getComputedStyle(pr, '::after').content,
          prBottom: pr.getBoundingClientRect().bottom + scrollY, faqTop: f.getBoundingClientRect().top + scrollY, faqH: f.offsetHeight,
          hrs: document.querySelectorAll('#pricing hr, #faq hr, #pricing [class*="border-t"], #faq [class*="border-t"]').length,
          planCard: !!document.querySelector('#pricing .lp-card--accent'), cta: document.querySelector('#pricing a.btn')?.getAttribute('href'),
          items: document.querySelectorAll('#faq details').length, h2: document.querySelector('#faq h2')?.textContent,
          overflowX: document.documentElement.scrollWidth - innerWidth,
        };
      });
      // no divider element, border, shadow or pseudo-element line; the sections still meet exactly
      expect(g.borders).toEqual(['0px', '0px', '0px']); expect(g.shadows).toEqual(['none', 'none']);
      expect(g.before).toBe('none'); expect(g.after).toBe('none'); expect(g.hrs).toBe(0);
      expect(Math.abs(g.prBottom - g.faqTop)).toBeLessThan(1);
      // the backgrounds: white above, a gradient into #F1FCF2 below
      expect(g.prBg).toBe('rgb(255, 255, 255)'); expect(g.prImg).toBe('none');
      expect(g.faqImg).toContain('linear-gradient'); expect(g.faqImg).toContain('rgb(255, 255, 255)'); expect(g.faqImg).toContain('rgb(241, 252, 242)');
      expect(g.faqImg.match(/rgb\(/g).length).toBeGreaterThanOrEqual(4);                         // eased, not a two-colour ramp
      // real pixels down the left margin, read below the pinned Header (its translucent bar tints whatever scrolls under it)
      const clearOfHeader = await page.evaluate(() => Math.ceil(document.querySelector('header').getBoundingClientRect().bottom) + 24);
      const strip = async (docY0, docY1) => {
        await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), Math.max(0, docY0 - clearOfHeader));
        await page.waitForTimeout(150);
        const top = await page.evaluate(() => scrollY);
        const y0 = Math.round(docY0 - top);
        const png = await page.screenshot({ clip: { x: 2, y: y0, width: 4, height: Math.min(s.height - y0, Math.round(docY1 - docY0)) } });
        const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
        return Array.from({ length: info.height }, (_, y) => [data[y * info.width * info.channels], data[y * info.width * info.channels + 1], data[y * info.width * info.channels + 2]]);
      };
      const seam = await strip(g.faqTop - 100, g.faqTop + 220);
      const max = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
      for (let i = 1; i < seam.length; i++) expect(max(seam[i], seam[i - 1]), `row ${i}`).toBeLessThanOrEqual(2);       // no step anywhere: no line
      for (const v of seam[0]) expect(v).toBeGreaterThanOrEqual(250);                                                   // white above the seam
      const lower = await strip(g.faqTop + 140, g.faqTop + 200);                                                       // just below the gradient (8rem = 128px at most), above the cards
      const mid = lower[Math.floor(lower.length / 2)];
      [241, 252, 242].forEach((v, i) => expect(Math.abs(mid[i] - v)).toBeLessThanOrEqual(2));                          // the pale brand green
      // content and function unchanged
      expect(g.planCard).toBe(true); expect(g.cta).toBe('/register'); expect(g.items).toBe(5);
      expect(g.h2).toBe(lang === 'tr' ? 'Sıkça sorulan sorular' : 'Frequently asked questions');
      await page.locator('#faq summary').first().click();
      await expect(page.locator('#faq details').first()).toHaveAttribute('open', '');                                    // the accordion still opens
      expect(g.overflowX).toBeLessThanOrEqual(0);
    });
  }
}
