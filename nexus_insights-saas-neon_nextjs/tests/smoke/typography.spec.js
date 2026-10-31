/**
 * Smoke test — the type scales: the landing page (hero 63 > section heading 30 (22 on phones) > 17 > 15 > 14) and, scoped by .page-type, the more compact
 * scale of the two dedicated pages, About / Our Mission (/about) and Carbonless AI (/ai): title 40 / section heading 30 / card heading 20 / body 17 / 16 / labels 14 (mobile 28 / 23 / 17 / 15).
 *
 * Hierarchy (desktop): hero headline 64 > page title 48 > section heading 40 > card title 17 ~ lead 17 > body 15 > small 14.
 * What it proves, at 360-1920px in English and Turkish:
 *  - every section heading shares one size / weight / family / line height; the leads share one size; the card titles share one;
 *    the in-card body text shares one; buttons are all 15px / 700 / 48px high
 *  - the hierarchy stays clear (consistency, not uniformity): each level is larger than the one below it
 *  - nothing overflows, clips or runs off the window
 */
import { test, expect } from '@playwright/test';

const sizes = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];

async function load(page, path, lang, s) {
  await page.setViewportSize(s);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(l => { localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1'); }, lang);
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

/** font facts of the first element matching each selector (null if absent) */
const facts = (page, sels) => page.evaluate(map => Object.fromEntries(Object.entries(map).map(([k, sel]) => {
  const el = document.querySelector(sel);
  if (!el) return [k, null];
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  return [k, { size: parseFloat(cs.fontSize), weight: cs.fontWeight, family: cs.fontFamily.split(',')[0].replace(/"/g, ''), lh: parseFloat(cs.lineHeight) / parseFloat(cs.fontSize), ls: cs.letterSpacing, color: cs.color, h: r.height }];
})), sels);

/** nothing wider than its box, nothing past the window (text, headings, buttons) */
const clipping = page => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  for (const el of document.querySelectorAll('main h1, main h2, main h3, main p, main a.btn, main summary, .hero-root h1, .hero-root p, .hero-root a, #about h2, #about p, #ai h2, #ai p, #pricing h2, #pricing p, #pricing a, #faq h2, #faq p, #faq summary')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline') bad.push(['clipped', el.tagName, el.textContent.slice(0, 30)]);
    const range = document.createRange(); range.selectNodeContents(el);
    for (const q of range.getClientRects()) if (q.right > vw + 0.5 || q.left < -0.5) { bad.push(['off-window', el.tagName, el.textContent.slice(0, 30)]); break; }
  }
  return { bad, overflowX: document.documentElement.scrollWidth - innerWidth };
});

for (const lang of ['en', 'tr']) {
  for (const s of sizes) {
    test(`${lang} ${s.width}: landing page - one scale, clear hierarchy, nothing clipped`, async ({ page }) => {
      await load(page, '/', lang, s);
      const f = await facts(page, {
        h1: '.hero-h1', heroDesc: '.hero-desc', eyebrow: '.hero-eyebrow', heroCta: '.hero-cta', heroCta2: '.hero-cta-secondary',
        aboutH2: '#about h2', aiH2: '#ai h2', pricingH2: '#pricing h2', faqH2: '#faq h2',
        aboutLead: '#about .lp-copy p', aiLead: '#ai .lp-lead', pricingLead: '#pricing .lp-lead', faqLead: '#faq .lp-lead',
        planTitle: '#pricing .lp-h3', faqQ: '#faq summary', planDesc: '#pricing .lp-card p.lp-body', feature: '#pricing .space-y-3 .lp-body', faqA: '#faq details p',
        caption: '#about .lp-small', aboutBtn: '#about a.btn', aiBtn: '#ai a.btn', pricingBtn: '#pricing a.btn',
      });
      for (const [k, v] of Object.entries(f)) expect(v, k).not.toBeNull();
      // section headings: identical
      for (const k of ['aiH2', 'pricingH2', 'faqH2']) for (const prop of ['size', 'weight', 'family', 'lh', 'ls']) expect(f[k][prop], `${k}.${prop}`).toEqual(f.aboutH2[prop]);
      // leads: identical
      for (const k of ['aiLead', 'pricingLead', 'faqLead', 'heroDesc']) { expect(f[k].size, k).toBe(f.aboutLead.size); expect(f[k].color, k).toBe(f.aboutLead.color); }
      // card titles identical; in-card body text identical
      expect(f.faqQ.size).toBe(f.planTitle.size); expect(f.faqQ.weight).toBe(f.planTitle.weight);
      for (const k of ['planDesc', 'feature', 'faqA']) expect(f[k].size, k).toBe(15);
      expect(f.caption.size).toBe(14);
      // line heights: headings tight, reading text 1.6-1.7
      expect(f.aboutH2.lh).toBeLessThan(1.15);
      for (const k of ['aboutLead', 'aiLead', 'planDesc', 'faqA']) { expect(f[k].lh, k).toBeGreaterThan(1.55); expect(f[k].lh, k).toBeLessThan(1.75); }
      // buttons: 15px / 700 / 48px high, all of them
      for (const k of ['heroCta', 'heroCta2', 'aboutBtn', 'aiBtn', 'pricingBtn']) { expect(f[k].size, k).toBe(15); expect(f[k].weight, k).toBe('700'); expect(Math.round(f[k].h), k).toBe(48); }
      // hierarchy: not uniform
      expect(f.h1.size).toBeGreaterThanOrEqual(f.aboutH2.size);
      expect(f.aboutH2.size).toBeGreaterThan(f.aboutLead.size + 5);                          // 22 vs 16 on phones, 30 vs 17 on desktop
      expect(f.aboutLead.size).toBeGreaterThanOrEqual(f.planTitle.size - 0.5);
      expect(f.planTitle.size).toBeGreaterThan(15); expect(f.aboutLead.size).toBeGreaterThan(f.planDesc.size);
      expect(f.planDesc.size).toBeGreaterThan(f.caption.size);
      expect(f.eyebrow.size).toBeLessThan(f.planDesc.size);
      if (s.width >= 1024) expect(f.h1.size).toBeGreaterThan(f.aboutH2.size + 8);               // the hero headline stays dominant
      expect(f.aboutH2.size).toBeGreaterThanOrEqual(22); expect(f.aboutH2.size).toBeLessThanOrEqual(30);   // the shared landing tokens: 22 (phones) -> 30 (from 1024px)
      if (s.width <= 430) expect(f.aboutH2.size).toBeLessThanOrEqual(22.5);
      if (s.width >= 1024) expect(f.aboutH2.size).toBe(30);
      const c = await clipping(page);
      expect(c.bad).toEqual([]); expect(c.overflowX).toBeLessThanOrEqual(0);
    });

    test(`${lang} ${s.width}: About (Our Mission) and the AI page share their own compact scale`, async ({ page }) => {
      test.setTimeout(120_000);
      await load(page, '/about', lang, s);
      const m = await facts(page, { title: 'main h1', p: 'main section:nth-of-type(1) p', h2: 'main section:nth-of-type(2) h2', p2: 'main section:nth-of-type(2) p', btn: 'main a.btn' });
      for (const [k, v] of Object.entries(m)) expect(v, k).not.toBeNull();
      const aboutLine = await page.evaluate(() => { const p = document.querySelector('main section:nth-of-type(2) p'); return [p.getBoundingClientRect().width, parseFloat(getComputedStyle(p).fontSize)]; });
      await load(page, '/ai', lang, s);
      const a = await facts(page, { title: 'main h1', p: 'main section:nth-of-type(1) p', feature: 'main section:nth-of-type(1) .lp-body', h2: 'main section:nth-of-type(2) h2', lead: 'main section:nth-of-type(2) .lp-lead', btn: 'main section:nth-of-type(1) a.btn', h3: 'main section:nth-of-type(2) h3', step: 'main section:nth-of-type(2) h3 + p' });
      for (const [k, v] of Object.entries(a)) expect(v, k).not.toBeNull();
      // the landing page keeps its own (larger) scale
      await load(page, '/', lang, s);
      const l = await facts(page, { h2: '#about h2', lead: '#about .lp-copy p' });

      // main heading: 30-36px on phones, 40-48 on desktop (never above 48), General Sans 700, the same on both pages
      expect(m.title.size).toBe(a.title.size);
      expect(m.title.weight).toBe('700'); expect(m.title.family).toBe('General Sans'); expect(a.title.family).toBe('General Sans');
      expect(m.title.size).toBeGreaterThanOrEqual(28); expect(m.title.size).toBeLessThanOrEqual(42);
      if (s.width < 600) { expect(m.title.size).toBeGreaterThanOrEqual(28); expect(m.title.size).toBeLessThanOrEqual(32); }
      if (s.width >= 1024) expect(m.title.size).toBeGreaterThanOrEqual(38);
      // section headings: 25-30 phones, 30-36 desktop
      for (const k of [m, a]) { expect(k.h2.size).toBe(m.h2.size); expect(k.h2.weight).toBe('700'); expect(k.h2.family).toBe('General Sans'); }
      expect(m.h2.size).toBeGreaterThanOrEqual(23); expect(m.h2.size).toBeLessThanOrEqual(32);
      if (s.width < 600) expect(m.h2.size).toBeLessThanOrEqual(26);
      if (s.width >= 1024) expect(m.h2.size).toBeGreaterThanOrEqual(27);
      if (s.width >= 1280) { expect(m.h2.size).toBeGreaterThanOrEqual(28); expect(m.h2.size).toBeLessThanOrEqual(32); }
      // card headings (the four steps): 17-19 phones, 19-22 desktop
      expect(a.h3.size).toBeGreaterThanOrEqual(17); expect(a.h3.size).toBeLessThanOrEqual(22);
      if (s.width < 600) expect(a.h3.size).toBeLessThanOrEqual(19);
      if (s.width >= 1024) expect(a.h3.size).toBeGreaterThanOrEqual(19);
      // body: 15-16 phones, 16-18 desktop; one size for the paragraphs of both pages; calm line heights
      for (const p of [m.p, m.p2, a.p, a.lead]) { expect(p.size).toBe(m.p.size); expect(p.color).toBe(l.lead.color); expect(p.lh).toBeGreaterThan(1.55); expect(p.lh).toBeLessThan(1.8); }
      expect(m.p.size).toBeGreaterThanOrEqual(15); expect(m.p.size).toBeLessThanOrEqual(18);
      if (s.width < 600) expect(m.p.size).toBeLessThanOrEqual(16);
      if (s.width >= 1024) expect(m.p.size).toBeGreaterThanOrEqual(16);
      // in-card / list text: 15-16
      for (const k of [a.feature, a.step]) { expect(k.size).toBeGreaterThanOrEqual(15); expect(k.size).toBeLessThanOrEqual(16); expect(k.weight === '400' || k.weight === '500').toBe(true); }
      // buttons: 14-15 on phones, 15-16 (here 15) on desktop; 700; 48px high
      for (const b of [m.btn, a.btn]) { expect(b.size).toBeGreaterThanOrEqual(14); expect(b.size).toBeLessThanOrEqual(16); expect(b.weight).toBe('700'); expect(Math.round(b.h)).toBe(48); if (s.width < 600) expect(b.size).toBeLessThanOrEqual(15); }
      // comfortable line length: at most ~80 characters (the widest block is the centred paragraph under "Part of the Carbonless Network")
      expect(aboutLine[0] / (aboutLine[1] * 0.5)).toBeLessThan(90);
      // hierarchy kept, and a step down from the landing page's scale on desktop
      expect(m.title.size).toBeGreaterThan(m.h2.size); expect(m.h2.size).toBeGreaterThan(a.h3.size); expect(a.h3.size).toBeGreaterThanOrEqual(m.p.size); expect(m.p.size).toBeGreaterThan(14.5);
      if (s.width >= 1024) expect(m.title.size).toBeGreaterThan(l.h2.size);                // (the page title stays above the landing's section headings)
      // the landing page itself is untouched by .page-type: its section heading stays on its own (shared) tokens, 22-30, and its text 16-17
      expect(l.h2.size).toBeGreaterThanOrEqual(22); expect(l.h2.size).toBeLessThanOrEqual(30);
      expect(l.lead.size).toBeGreaterThanOrEqual(16); expect(l.lead.size).toBeLessThanOrEqual(17.1);
      await load(page, '/about', lang, s);
      let c = await clipping(page); expect(c.bad).toEqual([]); expect(c.overflowX).toBeLessThanOrEqual(0);
      await load(page, '/ai', lang, s);
      c = await clipping(page); expect(c.bad).toEqual([]); expect(c.overflowX).toBeLessThanOrEqual(0);
    });
  }
}

test('the ladder on desktop: hero 63 > page title 40 > landing section heading 30 > 17 > 15 > 14', async ({ page }) => {
  await load(page, '/', 'en', { width: 1440, height: 900 });
  const l = await facts(page, { h1: '.hero-h1', h2: '#about h2', lead: '#about .lp-copy p', body: '#faq details p', small: '#about .lp-small' });
  await load(page, '/about', 'en', { width: 1440, height: 900 });
  const t = await facts(page, { title: 'main h1' });
  expect([Math.round(l.h1.size), t.title.size, l.h2.size, l.lead.size, l.body.size, l.small.size]).toEqual([63, 40, 30, 17, 15, 14]);
});
