/**
 * Smoke test — Our Mission (/about): public/greeen.png, and only there.
 *
 *  - greeen.png (1261x1247, transparent, art x 96-1260, y 5-1135) is the Our Mission picture: undistorted, nothing visible cropped, beside the
 *    text (or under it), inside the window; it is on no other page or section, and eco.png / aboutNEWW.png / about-img.png are not on /about
 *  - the Mission section is pure white: no glow, no tinted band behind the picture
 *  - it fades in and slides in once as the section shows, then floats; pauses off screen / in a hidden tab; reduced motion = still
 *  - on hover it rises ~6px and grows ~3%, smoothly and undistorted; with reduced motion it does not move
 */
import { test, expect } from '@playwright/test';

async function open(page, path = '/about', lang = 'en') {
  await page.addInitScript(l => { localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1'); }, lang);
  await page.goto(path);
}
const rectOf = (page, sel) => page.evaluate(s => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; }, sel);

test.describe('Our Mission picture', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('is greeen.png (its real project path), undistorted, with all of its visible art inside the box', async ({ page }) => {
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
    expect(m.src).toMatch(/\/greeen\.png$/);                                           // the asset in public/, not a copy
    expect([m.nw, m.nh]).toEqual([1261, 1247]);
    expect(m.clear).toBeGreaterThan(0.3);
    expect(m.x0).toBeGreaterThan(85); expect(m.x0).toBeLessThan(110);                   // the picture has a small empty margin at the left (art x 96-1260); the box shows the whole canvas
    expect(Math.abs(m.w / m.h - 1261 / 1247)).toBeLessThan(0.01);               // natural proportions
    const k = m.w / 1261;
    expect(m.x + m.x0 * k).toBeGreaterThanOrEqual(m.bx - 0.5);                           // all visible art starts inside the box
    expect(m.x + m.x1 * k).toBeLessThanOrEqual(m.br + 0.5);                              // ...and ends inside it
    expect(Math.abs(m.bw / m.bh - 1261 / 1247)).toBeLessThan(0.01);                      // the box has the picture's own ratio: the whole 1261 x 1247 canvas
    expect(m.alt).toBe('Trees shaped into a circular arrow around an industrial site, with a soft plume of smoke rising');
    expect(requested.filter(u => /about-img|eco\.png|aboutNEW/.test(u))).toEqual([]);      // the earlier Mission pictures (about-img.png, aboutNEW.png, aboutNEWW.png) and the AI picture are not used here
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
      expect(await page.locator('img[src*="greeen"], [data-testid="mission-visual"]').count(), path).toBe(0);
      expect(requested.filter(u => /greeen/.test(u)), path).toEqual([]);
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
    expect(pic.w).toBeGreaterThan(360); expect(pic.w).toBeLessThan(620);   // 400 px: a restrained size
  });

  test('enters once (fades in and slides in a few px from the right), then floats gently; pauses off screen and in a hidden tab', async ({ page }) => {
    test.setTimeout(40_000);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      window.__m = [];
      const tick = () => { const e = document.querySelector('[data-testid="mission-visual"] .eco-in'); if (e) { const cs = getComputedStyle(e); window.__m.push([Number(cs.opacity), new DOMMatrix(cs.transform).m41]); } requestAnimationFrame(tick); };
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
        expect(Math.abs(pic.w / pic.h - 1261 / 1247)).toBeLessThan(0.02);
        expect(pic.w).toBeGreaterThan(Math.min(260, s.width * 0.7));   // 300 px on phones
        if (s.width >= 1024) expect(pic.x).toBeGreaterThan(text.r - 4); else expect(pic.y).toBeGreaterThan(text.b - 4);
        expect(await page.locator('[data-testid="mission-visual"]').count()).toBe(1);
        expect(await page.getByTestId('mission-visual-img').getAttribute('alt')).toBe(lang === 'tr' ? 'Bir sanayi tesisini çevreleyen, dairesel ok biçiminde ağaçlar; tesisten hafif bir duman yükseliyor' : 'Trees shaped into a circular arrow around an industrial site, with a soft plume of smoke rising');
        expect((await page.locator('main h1').innerText()).trim()).toBe(lang === 'tr' ? 'Misyonumuz' : 'Our Mission');
      });
    }
  }
});

test.describe('Our Mission picture: white background and hover', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the asset is public/greeen.png and the older Mission pictures are still in the project', async () => {
    const fs = await import('node:fs'); const path = await import('node:path');
    const sharp = (await import('sharp')).default;
    const meta = await sharp(path.join(process.cwd(), 'public', 'greeen.png')).metadata();
    expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual(['png', 1261, 1247, true]);
    expect(fs.existsSync(path.join(process.cwd(), 'public', 'aboutNEWW.png'))).toBe(true);   // nothing was deleted
    expect(fs.existsSync(path.join(process.cwd(), 'public', 'greeen (1).png'))).toBe(false);   // and no duplicate of the new one
  });

  test('the Mission section is pure white: no glow, no tint, no gradient behind the picture', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(page.getByTestId('mission-visual')).toHaveAttribute('data-shown', 'true');
    const f = await page.evaluate(() => {
      const sec = document.querySelector('main section:first-of-type'), vis = document.querySelector('[data-testid="mission-visual"]');
      const chain = []; for (let e = vis; e && e !== document.documentElement; e = e.parentElement) chain.push([getComputedStyle(e).backgroundColor, getComputedStyle(e).backgroundImage]);
      return { page: getComputedStyle(document.querySelector('.page-type')).backgroundColor, sec: [getComputedStyle(sec).backgroundColor, getComputedStyle(sec).backgroundImage], glow: getComputedStyle(vis.querySelector('.eco-glow')).display, chain, mask: getComputedStyle(vis.querySelector('.eco-mask')).maskImage || getComputedStyle(vis.querySelector('.eco-mask')).webkitMaskImage };
    });
    expect(f.page).toBe('rgb(255, 255, 255)');
    expect(f.sec[1]).toBe('none'); expect(['rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)']).toContain(f.sec[0]);
    expect(f.glow).toBe('none');                                                   // the green glow is off for this picture
    for (const [c, i] of f.chain.slice(0, 6)) { expect(i).toBe('none'); expect(['rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)']).toContain(c); }
    expect(f.mask).toContain('to right');                                          // only a short fade where the smoke meets the canvas edge
  });

  test('hovering lifts it ~6px and grows it ~3%, smoothly and undistorted; leaving puts it back', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    await expect(page.getByTestId('mission-visual')).toHaveAttribute('data-shown', 'true');
    await page.waitForTimeout(1500);                                               // the entrance has finished
    const mask = () => page.locator('[data-testid="mission-visual"] .eco-mask').evaluate(el => { const m = new DOMMatrix(getComputedStyle(el).transform); return { sx: m.a, sy: m.d, ty: m.f, dur: getComputedStyle(el).transitionDuration }; });
    const before = await mask();
    expect([before.sx, before.sy]).toEqual([1, 1]);
    const c0 = await rectOf(page, '[data-testid="mission-visual"]');
    await page.mouse.move(c0.x + c0.w / 2, c0.y + c0.h / 2);                       // (a real mouse move: the picture floats, so Playwright's own hover never sees it as "stable")
    await page.waitForTimeout(900);
    const hov = await mask();
    expect(hov.sx).toBeGreaterThan(1.025); expect(hov.sx).toBeLessThan(1.035);     // ~1.03
    expect(Math.abs(hov.sx - hov.sy)).toBeLessThan(0.0005);                       // uniform: never stretched
    expect(hov.ty).toBeLessThan(-4); expect(hov.ty).toBeGreaterThan(-9);           // a slight lift
    expect(parseFloat(hov.dur)).toBeGreaterThanOrEqual(0.4); expect(parseFloat(hov.dur)).toBeLessThanOrEqual(0.8);   // smooth
    const box = await rectOf(page, '[data-testid="mission-visual"]');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    expect(box.r).toBeLessThanOrEqual(1440);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(900);
    const after = await mask();
    expect([after.sx, after.sy, Math.round(after.ty)]).toEqual([1, 1, 0]);
  });

  test('reduced motion: hovering changes nothing', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(page.getByTestId('mission-visual')).toHaveAttribute('data-shown', 'true');
    const c0 = await rectOf(page, '[data-testid="mission-visual"]');
    await page.mouse.move(c0.x + c0.w / 2, c0.y + c0.h / 2);
    await page.waitForTimeout(300);
    const t = await page.locator('[data-testid="mission-visual"] .eco-mask').evaluate(el => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(t);
  });

  test('the /ai picture does not get the hover or the white-only treatment (it is unchanged)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/ai');
    await expect(page.getByTestId('eco')).toHaveAttribute('data-shown', 'true');
    const f = await page.evaluate(() => ({ cls: document.querySelector('[data-testid="eco"]').className, glow: getComputedStyle(document.querySelector('[data-testid="eco"] .eco-glow')).display }));
    expect(f.cls).not.toMatch(/eco--lift|eco--plain/);
    expect(f.glow).not.toBe('none');
  });
});
