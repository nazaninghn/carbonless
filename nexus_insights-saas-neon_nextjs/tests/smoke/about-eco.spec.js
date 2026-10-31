/**
 * Smoke test — public/eco.png on the dedicated Carbonless AI page (/ai), and the About -> AI background on the landing page.
 *
 *  - /ai shows eco.png (1536x1024, transparent) instead of the old head picture (ai-img.png), undistorted, uncropped where it
 *    matters, balanced with the text; eco.png appears NOWHERE else: the landing page (Hero, About, AI section) has none
 *  - the landing page keeps the laptop illustration in its AI section (its own spec: about-laptop.spec.js)
 *  - About stays pure white; the AI section is a very pale brand green that melts in from the white above and out into the
 *    white below: no visible line between them (checked on real screenshot pixels)
 *  - the picture fades in and rises once when it first scrolls into view, then floats gently; the ambient motion pauses
 *    off screen / in a hidden tab; reduced motion shows it at once, still; no layout shift while it loads
 */
import { test, expect } from '@playwright/test';
import sharp from 'sharp';

async function open(page, { lang = 'en' } = {}) {
  await page.addInitScript(l => { localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1'); }, lang);
  await page.goto('/ai');
  await expect(page.getByTestId('eco')).toBeAttached();
}
const SECTION = 'main section';
const TEXT = 'main section:first-of-type .grid > div:first-child';
const toEco = page => page.evaluate(() => document.querySelector('[data-testid="eco"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
const rectOf = (page, sel) => page.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; }, sel);
const overlaps = (a, b, pad = 0) => a.x < b.r + pad && a.r > b.x - pad && a.y < b.b + pad && a.b > b.y - pad;
const ecoAnims = page => page.evaluate(() => document.getAnimations().filter(a => a.effect?.target?.closest?.('[data-testid="eco"]')).map(a => ({ name: a.animationName, state: a.playState })));

test.describe('eco.png', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('is the AI section picture: eco.png, undistorted, nothing visible cropped; the laptop is gone from the section', async ({ page }) => {
    const requested = [];
    page.on('request', r => requested.push(decodeURIComponent(new URL(r.url()).pathname + new URL(r.url()).search)));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await toEco(page);
    await expect(page.getByTestId('eco')).toHaveAttribute('data-shown', 'true');
    const m = await page.evaluate(async () => {
      const img = document.querySelector('[data-testid="eco-img"]'), box = document.querySelector('[data-testid="eco"]');
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, x1 = -1, clear = 0;
      for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x++) { const a = d[(y * c.width + x) * 4 + 3]; if (a === 0) clear++; if (a > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } }
      const ib = img.getBoundingClientRect(), bb = box.getBoundingClientRect();
      return { src: decodeURIComponent(img.currentSrc), nw: img.naturalWidth, nh: img.naturalHeight, w: ib.width, h: ib.height, x: ib.x, bx: bb.x, bw: bb.width, bh: bb.height, x0, x1, clearFrac: clear / (c.width * c.height / 2),
               imgsInSection: document.querySelectorAll('main section:first-of-type img').length, laptop: !!document.querySelector('[data-testid="laptop"]'), oldImg: document.querySelectorAll('img[src*="ai-img"]').length, alt: img.alt };
    });
    expect(m.src).toContain('eco.png');
    expect([m.nw, m.nh]).toEqual([1536, 1024]);
    expect(m.clearFrac).toBeGreaterThan(0.3);                                // real transparency
    expect(m.x0).toBeGreaterThan(280); expect(m.x0).toBeLessThan(320);       // the left ~19% of the canvas is empty (this is what the box leaves out)
    expect(Math.abs(m.w / m.h - 1536 / 1024)).toBeLessThan(0.01);            // natural proportions
    const k = m.w / 1536;
    expect(m.x + m.x0 * k).toBeGreaterThanOrEqual(m.bx - 0.5);               // the visible art starts inside the box: nothing cropped on the left
    expect(Math.abs(m.bw / m.bh - 1256 / 1024)).toBeLessThan(0.01);
    expect(m.imgsInSection).toBe(1);
    expect(m.laptop).toBe(false);
    expect(m.oldImg).toBe(0);                                                // the old head picture is no longer used here
    expect(requested.filter(u => /ai-img/.test(u))).toEqual([]);             // ...nor even loaded
    expect(m.alt).toBe('A human profile made of leaves, trees and circuit lines');
  });

  test('balanced: the face looks toward the text, the picture is centred on it vertically, nothing collides', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await toEco(page);
    const eco = await rectOf(page, '[data-testid="eco"]');
    const text = await page.evaluate(sel => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom }; }, TEXT);
    expect(eco.x).toBeGreaterThan(text.r - 4);
    expect(Math.abs((eco.y + eco.b) / 2 - (text.y + text.b) / 2)).toBeLessThan(60);
    expect(eco.w).toBeGreaterThan(420); expect(eco.w).toBeLessThan(600);
  });

  test('enters once: fades in and rises a few pixels as the section first shows, then floats gently; plays only once per page load', async ({ page }) => {
    test.setTimeout(40_000);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // the picture is part of the first screen of /ai, so its entrance runs as the page opens: record it from the first frame
    await page.addInitScript(() => {
      window.__eco = [];
      const tick = () => {
        const e = document.querySelector('.eco-in');
        if (e) { const cs = getComputedStyle(e); window.__eco.push([Number(cs.opacity), new DOMMatrix(cs.transform).m42, performance.now()]); }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await open(page);
    await expect(page.getByTestId('eco')).toHaveAttribute('data-shown', 'true');
    await page.waitForTimeout(1800);
    const samples = await page.evaluate(() => window.__eco);
    expect(samples.length).toBeGreaterThan(20);
    expect(samples[0][0]).toBeLessThan(0.2);                                                   // it starts hidden...
    expect(samples[0][1]).toBeGreaterThan(8);                                                  // ...a little lower
    const mid = samples.find(s => s[0] > 0.1 && s[0] < 0.9);
    expect(mid).toBeTruthy();                                                                  // a real fade, not a cut
    const last = samples[samples.length - 1];
    expect(last[0]).toBe(1); expect(Math.abs(last[1])).toBeLessThan(0.5);                      // settled in its final place
    for (let i = 1; i < samples.length; i++) { expect(samples[i][0]).toBeGreaterThanOrEqual(samples[i - 1][0] - 0.001); expect(samples[i][1]).toBeLessThanOrEqual(samples[i - 1][1] + 0.5); }   // only forward: in and up
    expect(Math.max(...samples.map(s => s[1]))).toBeLessThanOrEqual(24);                       // "a few pixels"

    // ambient: floats a few pixels, slowly
    const ys = [];
    for (let i = 0; i < 5; i++) { ys.push(await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.eco-float')).transform).m42)); await page.waitForTimeout(700); }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.2);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(10);
    const fl = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('.eco-float')); return [cs.animationName, parseFloat(cs.animationDuration), cs.animationTimingFunction]; });
    expect(fl[0]).toBe('eco-float'); expect(fl[1]).toBeGreaterThanOrEqual(8); expect(fl[2]).toBe('ease-in-out');
    expect(await page.evaluate(() => Math.max(...[...document.querySelectorAll('.eco-float')].map(e => new DOMMatrix(getComputedStyle(e).transform).a)))).toBeLessThan(1.02);   // a barely-there scale

    // once per page load: scroll away and back and it is simply there, with no new entrance
    await page.evaluate(() => window.scrollTo({ top: 99999, behavior: 'instant' }));
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.__eco = []; window.scrollTo({ top: 0, behavior: 'instant' }); });
    await page.waitForTimeout(500);
    const again = await page.evaluate(() => window.__eco);
    expect(again.length).toBeGreaterThan(5);
    for (const s of again) { expect(s[0]).toBe(1); expect(Math.abs(s[1])).toBeLessThan(0.5); }
    expect(await page.getByTestId('eco').getAttribute('data-shown')).toBe('true');
  });

  test('ambient motion pauses off screen and in a hidden tab, and resumes', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    await toEco(page);
    await expect(page.getByTestId('eco')).toHaveAttribute('data-ambient', 'running');
    expect((await ecoAnims(page)).filter(a => /eco-/.test(a.name)).every(a => a.state === 'running')).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 99999, behavior: 'instant' }));
    await expect(page.getByTestId('eco')).toHaveAttribute('data-ambient', 'paused');
    expect((await ecoAnims(page)).filter(a => /eco-/.test(a.name)).every(a => a.state === 'paused')).toBe(true);
    await toEco(page);
    await expect(page.getByTestId('eco')).toHaveAttribute('data-ambient', 'running');
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(page.getByTestId('eco')).toHaveAttribute('data-ambient', 'paused');
    expect((await ecoAnims(page)).filter(a => /eco-/.test(a.name)).every(a => a.state === 'paused')).toBe(true);
  });

  test('reduced motion: shown at once in its final place, nothing moves', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(page.getByTestId('eco')).toHaveAttribute('data-shown', 'true');         // even before it is scrolled to
    const s = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector('.eco-in')); return [Number(cs.opacity), cs.transform, cs.transitionDuration]; });
    expect(s[0]).toBe(1); expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(s[1]); expect(s[2]).toBe('0s');
    expect(await ecoAnims(page)).toEqual([]);
    await expect(page.getByTestId('eco')).toHaveAttribute('data-ambient', 'paused');
  });

  test('no layout shift while the picture loads: the box, the text and the page stay put', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route(/eco\.png/, async route => { await new Promise(r => setTimeout(r, 4000)); await route.continue(); });
    await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
    await open(page);
    await page.evaluate(() => document.fonts.ready);
    await toEco(page);
    const pick = () => page.evaluate(() => ['[data-testid="eco"]', 'main h1', 'main section:first-of-type', 'main section:nth-of-type(2)'].map(s => { const b = document.querySelector(s).getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(v => Math.round(v * 2) / 2); }).concat([[document.documentElement.scrollHeight]]));
    await page.waitForTimeout(1000);                                  // (the section's own slide-up reveal, 0.7 s, is not the picture's)
    const before = await pick();
    expect(await page.evaluate(() => document.querySelector('[data-testid="eco-img"]').naturalWidth)).toBe(0);   // it really had not arrived
    await expect.poll(() => page.evaluate(() => document.querySelector('[data-testid="eco-img"]').naturalWidth), { timeout: 15_000 }).toBe(1536);
    await page.waitForTimeout(300);
    expect(await pick()).toEqual(before);
    expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.02);
  });
});

test.describe('landing: About white -> AI soft green (with the laptop), and no eco.png anywhere on it', () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });
  const sizes = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 820, height: 1180 },
    { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];
  for (const lang of ['en', 'tr']) {
    for (const s of sizes) {
      test(`${lang} ${s.width}: Hero, About and the AI laptop are as before; About white, AI softly green, no line between them`, async ({ page }) => {
        const requested = [];
        page.on('request', r => requested.push(decodeURIComponent(new URL(r.url()).pathname)));
        await page.setViewportSize(s);
        await page.addInitScript(l => { localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1'); }, lang);
        await page.goto('/');
        await expect(page.getByTestId('hero-h1')).toBeVisible();
        const bg = await page.evaluate(() => {
          const cs = id => getComputedStyle(document.getElementById(id));
          const ai = document.getElementById('ai'), about = document.getElementById('about'), pricing = document.getElementById('pricing');
          return { about: cs('about').backgroundColor, aboutImg: cs('about').backgroundImage, pricing: cs('pricing').backgroundColor, aiImg: cs('ai').backgroundImage,
                   aiBorder: [cs('ai').borderTopWidth, cs('ai').borderBottomWidth], aboutBorder: cs('about').borderBottomWidth,
                   aiTop: ai.getBoundingClientRect().top + scrollY, aiBottom: ai.getBoundingClientRect().bottom + scrollY, aiH: ai.offsetHeight, aboutBottom: about.getBoundingClientRect().bottom + scrollY, pricingTop: pricing.getBoundingClientRect().top + scrollY,
                   eco: document.querySelectorAll('[data-testid="eco"], img[src*="eco"]').length, laptopInAi: !!document.querySelector('#ai [data-testid="laptop"]'), laptopInHero: !!document.querySelector('.hero-root [data-testid="laptop"]'),
                   laptopSrc: [...document.querySelectorAll('[data-testid="laptop"] img')].map(i => decodeURIComponent(i.currentSrc || i.src)),
                   heroImgs: [...document.querySelectorAll('.hero-root img')].map(i => decodeURIComponent(i.currentSrc || i.src)),
                   phone: document.querySelectorAll('#about [data-testid="phone-slide"]').length, earth: !!document.querySelector('.hero-root [data-testid="hero-earth"]') };
        });
        // placement: eco.png appears nowhere on the landing page; the laptop is in the AI section (not in the Hero); the Hero keeps only its Earth
        expect(bg.eco).toBe(0);
        expect(requested.filter(u => /eco\.png/.test(u))).toEqual([]);
        expect(bg.laptopInAi).toBe(true); expect(bg.laptopInHero).toBe(false);
        expect(bg.laptopSrc.length).toBe(2); for (const src of bg.laptopSrc) expect(src).toContain('ai-laptop.png');
        expect(bg.heroImgs.length).toBe(1); expect(bg.heroImgs[0]).toContain('globalnew-hero.webp'); expect(bg.earth).toBe(true);
        expect(bg.phone).toBe(4);                                                          // the About slideshow is untouched

        // backgrounds
        expect(bg.about).toBe('rgb(255, 255, 255)'); expect(bg.aboutImg).toBe('none');
        expect(bg.pricing).toBe('rgb(255, 255, 255)');
        expect(bg.aiImg).toContain('linear-gradient'); expect(bg.aiImg).toContain('rgb(241, 252, 242)');   // #F1FCF2
        expect(bg.aiBorder).toEqual(['0px', '0px']); expect(bg.aboutBorder).toBe('0px');
        expect(Math.abs(bg.aboutBottom - bg.aiTop)).toBeLessThan(1); expect(Math.abs(bg.aiBottom - bg.pricingTop)).toBeLessThan(1);
        // real pixels, down a narrow strip at the left margin: no step anywhere (no line), white at both seams, pale green in the middle
        const strip = async (docY0, docY1) => {
          await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), Math.max(0, docY0));
          await page.waitForTimeout(120);
          const top = await page.evaluate(() => scrollY);
          const png = await page.screenshot({ clip: { x: 2, y: 0, width: 4, height: Math.min(s.height, Math.round(docY1 - top)) } });
          const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
          return Array.from({ length: info.height }, (_, y) => [data[y * info.width * info.channels], data[y * info.width * info.channels + 1], data[y * info.width * info.channels + 2]]);
        };
        const max = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
        const seamTop = await strip(bg.aiTop - 60, bg.aiTop + 140);
        const seamBottom = await strip(bg.aiBottom - 140, bg.aiBottom + 60);
        for (const rows of [seamTop, seamBottom]) for (let i = 1; i < rows.length; i++) expect(max(rows[i], rows[i - 1])).toBeLessThanOrEqual(3);
        for (const v of seamTop[0]) expect(v).toBeGreaterThanOrEqual(244);      // white (a card shadow can tint the margin a little)
        for (const v of seamBottom[seamBottom.length - 1]) expect(v).toBeGreaterThanOrEqual(244);
        const middle = await strip(bg.aiTop + bg.aiH / 2 - 30, bg.aiTop + bg.aiH / 2 + 30);
        const mid = middle[Math.floor(middle.length / 2)];
        [241, 252, 242].forEach((v, i) => expect(Math.abs(mid[i] - v)).toBeLessThanOrEqual(12));   // the pale brand green (the laptop's own glow may add a hint)
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
        // the AI text and button are as they were
        const texts = await page.evaluate(() => document.querySelector('#ai .lp-split > div:first-child').innerText);
        expect(texts).toContain(lang === 'tr' ? 'Daha Fazla' : 'Learn More');
        expect(await page.locator('#ai a[href="/ai"]').count()).toBe(1);
      });
    }
  }
});

test.describe('/ai page: eco.png at every size, in both languages', () => {
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });
  const sizes = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 820, height: 1180 },
    { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];
  for (const lang of ['en', 'tr']) {
    for (const s of sizes) {
      test(`${lang} ${s.width}: eco.png in place beside / under the text, whole, no overflow`, async ({ page }) => {
        await page.setViewportSize(s);
        await open(page, { lang });
        await page.evaluate(() => document.querySelector('[data-testid="eco"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
        await expect(page.getByTestId('eco')).toHaveAttribute('data-shown', 'true');
        const eco = await rectOf(page, '[data-testid="eco"]');
        const text = await page.evaluate(sel => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom }; }, TEXT);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
        expect(eco.x).toBeGreaterThanOrEqual(0); expect(eco.r).toBeLessThanOrEqual(s.width);
        expect(Math.abs(eco.w / eco.h - 1256 / 1024)).toBeLessThan(0.02);
        expect(eco.w).toBeGreaterThan(Math.min(300, s.width * 0.7));
        expect(overlaps(eco, text, 0)).toBe(false);
        if (s.width >= 1024) expect(eco.x).toBeGreaterThan(text.r - 4); else expect(eco.y).toBeGreaterThan(text.b - 4);       // beside the text, or below it
        expect(await page.getByTestId('eco-img').getAttribute('alt')).toBe(lang === 'tr' ? 'Yapraklardan, ağaçlardan ve devre hatlarından oluşan bir insan profili' : 'A human profile made of leaves, trees and circuit lines');
        expect(await page.locator('[data-testid="eco"]').count()).toBe(1);                // exactly one eco.png on the page
        expect((await page.locator('main h1').innerText()).replace(/\s+/g, ' ')).toContain('Carbonless AI');
        const cta = await page.evaluate(() => [...document.querySelectorAll('main section:first-of-type a')].map(a => a.getAttribute('href')));
        expect(cta).toContain('/register');
        const body = await page.locator('main section:first-of-type').innerText();
        expect(body).toContain(lang === 'tr' ? 'Ücretsiz Dene' : 'Try Free');
        expect(body).not.toContain(lang === 'tr' ? 'Try Free' : 'Ücretsiz Dene');
      });
    }
  }
});
