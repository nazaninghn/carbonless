/**
 * Smoke test — landing page rhythm: a compact About card and even spacing between the sections.
 *
 *  - the white About card is compact: at most 460px wide, only a little taller than the phone, little white above and
 *    below it, the phone and the "Hey!" text side by side and vertically balanced, the green stripe behind the phone
 *  - the sections use one vertical rhythm (the same padding on About, AI, Pricing and FAQ; 36-60px, scaling with the screen),
 *    so the gaps between their backgrounds are never large
 *  - nothing overflows, clips or overlaps at 360-1920px, in English and Turkish
 */
import { test, expect } from '@playwright/test';

const sizes = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];

for (const lang of ['en', 'tr']) {
  for (const s of sizes) {
    test(`${lang} ${s.width}: compact About card, even section spacing, no overflow`, async ({ page }) => {
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
        const caption = [...card.querySelectorAll('p')].pop();
        const text = document.createRange(); text.selectNodeContents(hey.parentElement);
        const sections = [...document.querySelectorAll('.lp-section')].map(e => ({ id: e.id, top: parseFloat(getComputedStyle(e).paddingTop), bottom: parseFloat(getComputedStyle(e).paddingBottom), box: r(e) }));
        return { card: r(card), phone: r(phone), box: { w: phone.offsetWidth, h: phone.offsetHeight }, stripe: r(stripe), text: r(text), caption: r(caption), sections,
                 overflowX: document.documentElement.scrollWidth - innerWidth };
      });

      // the card: compact, not a big empty panel
      expect(g.card.w).toBeLessThanOrEqual(461);
      expect(g.card.w).toBeLessThanOrEqual(s.width - 24);
      expect(g.card.h).toBeLessThan(g.box.h + 160);                                     // only a little taller than the phone
      expect(g.card.h).toBeLessThan(s.width >= 640 ? 560 : 450);
      expect(g.phone.y - g.card.y).toBeLessThan(40);                                    // little white above the phone
      expect(g.card.b - g.caption.b).toBeLessThan(34);                                  // ...and below the caption
      // the phone is unchanged in size, and the stripe stands behind it
      expect(g.box.h).toBe(s.width >= 640 ? 385 : 280);
      expect(g.box.w).toBe(s.width >= 640 ? 192 : 154);
      expect(Math.abs((g.phone.x + g.phone.w / 2) - (g.stripe.x + g.stripe.w / 2))).toBeLessThan(6);
      expect(g.stripe.y).toBeLessThanOrEqual(g.card.y + 2);                              // up to the card's top edge
      expect(g.stripe.b).toBeGreaterThan(g.phone.b - 20);
      // phone and text side by side, aligned: the text is vertically centred on the phone, left of it, inside the card
      expect(g.text.r).toBeLessThan(g.phone.r);
      expect(g.text.x).toBeGreaterThanOrEqual(g.card.x + 12);
      expect(Math.abs((g.text.y + g.text.b) / 2 - (g.phone.y + g.phone.b) / 2)).toBeLessThan(g.phone.h * 0.12);
      expect(g.phone.x).toBeGreaterThanOrEqual(g.card.x); expect(g.phone.r).toBeLessThanOrEqual(g.card.r);
      expect(g.phone.b).toBeLessThan(g.caption.y + 6);
      // the card is centred in its column / on the page
      if (s.width < 1024) expect(Math.abs((g.card.x + g.card.r) / 2 - s.width / 2 + 7)).toBeLessThan(10);

      // one rhythm for About, AI, Pricing, FAQ
      expect(g.sections.map(x => x.id)).toEqual(['about', 'ai', 'pricing', 'faq']);
      const pads = g.sections.flatMap(x => [x.top, x.bottom]);
      for (const p of pads) { expect(p).toBeGreaterThanOrEqual(35); expect(p).toBeLessThanOrEqual(61); expect(p).toBe(pads[0]); }
      for (let i = 1; i < g.sections.length; i++) expect(Math.abs(g.sections[i].box.y - g.sections[i - 1].box.b)).toBeLessThan(1);   // backgrounds meet: no gaps between sections
      expect(g.overflowX).toBeLessThanOrEqual(0);
    });
  }
}

test.describe('the AI section: pale green that melts in from the white About (details: about-eco.spec.js)', () => {
  const widths = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 820, height: 1180 }, { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];
  for (const lang of ['en', 'tr']) {
    for (const s of widths) {
      test(`${lang} ${s.width}: AI has the soft green gradient; About, Pricing and the Hero keep theirs`, async ({ page }) => {
        await page.setViewportSize(s);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript(l => { localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1'); }, lang);
        await page.goto('/');
        await expect(page.locator('#ai')).toBeAttached();
        const g = await page.evaluate(() => {
          const st = id => { const cs = getComputedStyle(document.getElementById(id)); return { bg: cs.backgroundColor, img: cs.backgroundImage, boxShadow: cs.boxShadow }; };
          const ai = document.getElementById('ai');
          return { ai: st('ai'), about: st('about'), pricing: st('pricing'), faq: st('faq'), hero: getComputedStyle(document.querySelector('.hero-root')).backgroundColor,
                   // the section's own direct children (the container) add no tint either
                   aiChildren: [...ai.children].map(c => getComputedStyle(c).backgroundColor),
                   headline: getComputedStyle(ai.querySelector('h2')).color, lead: getComputedStyle(ai.querySelector('.lp-lead')).color,
                   laptop: !!document.querySelector('#ai [data-testid="laptop"]'), overflowX: document.documentElement.scrollWidth - innerWidth };
        });
        expect(g.ai.img).toContain('linear-gradient'); expect(g.ai.img).toContain('rgb(241, 252, 242)');   // #F1FCF2, fading to white at both edges
        expect(g.ai.boxShadow).toBe('none');
        for (const c of g.aiChildren) expect(['rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)']).toContain(c);   // no extra panel inside it
        // readable on white: dark green heading, grey-blue lead text
        expect(g.headline).toBe('rgb(23, 80, 34)');
        expect(g.lead).toBe('rgb(71, 85, 105)');
        expect(g.laptop).toBe(true);                                                   // the AI section's laptop is there
        // About / Pricing were white, FAQ is still the pale green, the Hero is unchanged
        expect(g.about.bg).toBe('rgb(255, 255, 255)'); expect(g.pricing.bg).toBe('rgb(255, 255, 255)');
        expect(g.faq.bg).not.toBe('rgb(255, 255, 255)'); expect(g.faq.bg).toMatch(/^rgb\(24\d, 25\d, 24\d\)$/);   // still the pale green
        expect(g.hero).toBe('rgb(248, 251, 248)');
        expect(g.overflowX).toBeLessThanOrEqual(0);
      });
    }
  }
});
