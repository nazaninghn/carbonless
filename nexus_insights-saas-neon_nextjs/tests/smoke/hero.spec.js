/**
 * Smoke test — landing hero (pure white): short copy on the left; the Earth, its orbital rings and the three Scope cards in the
 * middle; a tilted sample report preview beside the Earth.
 *
 * What it proves:
 *  - the Earth is public/globalnew-hero.webp (1254x1254, WebP with alpha: public/globalnew.png with its painted checkerboard cut to real
 *    transparency; both files stay), drawn once, undistorted, its round body centred in the stage; it floats a few pixels and does not turn
 *  - a click enlarges it in place (~12%, no overlay); clicking it again, Escape or a click outside restores it
 *  - copy: label, two-line headline, one short sentence, both calls to action (existing routes): EN / TR; and nothing else: no standards
 *    row, no feature strip, no badge
 *  - the background is plain white: no gradient, no tinted band, the pixels around the hero are #fff
 *  - the three Scope cards (real localised text, a popover each) stand left of the globe, tied to the ring
 *  - the report preview: a labelled, tilted SAMPLE (illustrative values that add up), beside the Earth and never over it; it is the only
 *    place with the ISO 14064-1 label
 *  - the Earth is large (a 25% bigger body than the first version) and the Scope cards hold only their title and one short description
 *  - a mouse-shaped scroll cue at the foot of the Hero leads to About (smooth scroll, instant with reduced motion)
 *  - motion: entrance + float + turning rings; reduced motion removes all of it; the hero pauses off screen
 *  - responsive: 360-1920px, no horizontal overflow, nothing clipped or colliding, the stack order on small screens
 *
 * The landing page needs no backend. Geometry of globalnew-hero.webp (measured on the file): canvas 1254x1254,
 * its round body (the ring of trees) is centred on (629.5, 640.5), radius 604.5.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ART = { w: 1254, h: 1254, cx: 629.5, cy: 640.5, bodyR: 604.5 };

async function open(page, { lang = 'en' } = {}) {
  await page.addInitScript(l => {
    localStorage.setItem('language', l);
    localStorage.setItem('language_explicit', '1');
  }, lang);
  await page.goto('/');
  await expect(page.getByTestId('hero-h1')).toBeVisible();
  await expect(page.getByTestId('hero-earth').locator('img')).toBeVisible();
  // (the page is rendered in English and switches to the chosen language just after it hydrates: wait for that before measuring)
  if (lang === 'tr') await expect(page.getByTestId('hero-eyebrow')).toHaveText('YAPAY ZEKÂ DESTEKLİ KARBON MUHASEBESİ');
}

/** Reduced motion, for real: `test.use({ reducedMotion })` is not applied in this setup, so emulate it. */
const reduceMotion = page => page.emulateMedia({ reducedMotion: 'reduce' });
const heroAnims = page => page.evaluate(() => document.getAnimations()
  .filter(a => a.effect?.target?.closest?.('.hero-root'))
  .map(a => ({ name: a.animationName, state: a.playState, infinite: a.effect.getComputedTiming().iterations === Infinity })));

const rect = async loc => loc.evaluate(el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; });
const overlaps = (a, b, pad = 0) => a.x < b.r + pad && a.r > b.x - pad && a.y < b.b + pad && a.b > b.y - pad;

test.describe('the Earth', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(async ({ page }) => { await reduceMotion(page); });

  test('is public/globalnew-hero.webp, the only picture in the hero besides the report logo, drawn undistorted', async ({ page }) => {
    const requested = [];
    page.on('request', rq => requested.push(decodeURIComponent(new URL(rq.url()).pathname)));
    await open(page);
    const info = await page.evaluate(() => {
      const img = document.querySelector('[data-testid="hero-earth"] img');
      const b = document.querySelector('[data-testid="hero-earth"]').getBoundingClientRect();
      return { src: decodeURIComponent(img.currentSrc), nw: img.naturalWidth, nh: img.naturalHeight, w: b.width, h: b.height, others: [...document.querySelectorAll('.hero-root img')].filter(i => !i.closest('[data-testid="hero-earth"]')).map(i => decodeURIComponent(i.currentSrc)), alt: img.getAttribute('alt') };
    });
    expect(info.src).toContain('globalnew-hero.webp');
    expect([info.nw, info.nh]).toEqual([ART.w, ART.h]);
    expect(info.others.length).toBe(1);
    expect(info.others[0]).toContain('carbonless.png');                       // the report's logo, the same one as the Header
    expect(info.alt).toBe('');                                                 // decorative: the headline carries the meaning
    expect(Math.abs(info.w / info.h - 1)).toBeLessThan(0.005);                 // aspect ratio preserved
    expect(requested.filter(u => /globalnew-hero\.png|herosection|\/earth\.png/.test(u))).toEqual([]);   // nor the 4.4 MB PNG
    const meta = await sharp(path.join(process.cwd(), 'public', 'globalnew-hero.webp')).metadata();
    expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual(['webp', ART.w, ART.h, true]);
    expect(fs.statSync(path.join(process.cwd(), 'public', 'globalnew-hero.webp')).size).toBeLessThan(1024 * 1024);
    const orig = await sharp(path.join(process.cwd(), 'public', 'globalnew.png')).metadata();   // the original is kept
    expect([orig.format, orig.width, orig.height]).toEqual(['png', ART.w, ART.h]);
  });

  test('its round body is centred on the rings and is the dominant, but not an oversized, visual', async ({ page }) => {
    await open(page);
    const g = await page.evaluate(A => {
      const e = document.querySelector('[data-testid="hero-earth"]').getBoundingClientRect();
      const k = e.width / A.w;
      const orbit = document.querySelector('[data-testid="hero-orbits"]').getBoundingClientRect();
      return { cx: e.x + A.cx * k, cy: e.y + A.cy * k, bodyD: 2 * A.bodyR * k, ox: orbit.x + orbit.width * 399 / 860, oy: orbit.y + orbit.height * 290 / 580, vw: innerWidth };
    }, ART);
    expect(Math.abs(g.cx - g.ox)).toBeLessThan(1.5);
    expect(Math.abs(g.cy - g.oy)).toBeLessThan(1.5);
    expect(g.bodyD).toBeGreaterThan(340);              // 25% larger than the first version (~302 px at this size)
    expect(g.bodyD).toBeLessThan(g.vw * 0.3);
  });

  test('a click enlarges it ~12% in place; again, Escape or a click outside restores it', async ({ page }) => {
    await open(page);
    const earth = page.getByTestId('hero-earth');
    const before = await rect(earth);
    await page.getByTestId('hero-earth-btn').click();
    await expect(earth).toHaveAttribute('data-zoomed', 'true');
    const after = await rect(earth);
    expect(after.w / before.w).toBeGreaterThan(1.1);
    expect(after.w / before.w).toBeLessThan(1.14);
    expect(Math.abs((after.x + after.w / 2) - (before.x + before.w / 2))).toBeLessThan(1);
    await page.keyboard.press('Escape');
    await expect(earth).toHaveAttribute('data-zoomed', 'false');
    await page.getByTestId('hero-earth-btn').click();
    await page.getByTestId('hero-h1').click();
    await expect(earth).toHaveAttribute('data-zoomed', 'false');
  });
});

test.describe('copy', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('English: label, headline, one sentence, both buttons (existing routes), and nothing else', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('hero-eyebrow')).toHaveText('AI-POWERED CARBON ACCOUNTING');
    await expect(page.getByTestId('hero-h1')).toHaveText('Measure. Report. Reduce.');
    await expect(page.locator('.hero-desc')).toHaveText('Turn your emissions data into actionable insights and real reduction.');
    await expect(page.getByRole('link', { name: 'Start Your Assessment' })).toHaveAttribute('href', '/register');
    await expect(page.getByRole('link', { name: 'Explore Platform' })).toHaveAttribute('href', '/features');
    // the copy block holds exactly: label, headline, sentence, buttons
    await expect(page.locator('.hero-copy > *')).toHaveCount(4);
    // no standards row, no feature strip, no badge row anywhere in the hero
    await expect(page.getByTestId('hero-standards')).toHaveCount(0);
    await expect(page.getByTestId('hero-features')).toHaveCount(0);
    const outsideReport = await page.evaluate(() => { const c = document.querySelector('.hero-root').cloneNode(true); c.querySelector('[data-testid="hero-report"]').remove(); return c.textContent; });
    expect(outsideReport).not.toMatch(/GHG Protocol|DEFRA|IPCC|ISO 14064/);
    // the ISO 14064-1 label lives inside the report preview only
    await expect(page.getByTestId('hero-report')).toContainText('ISO 14064-1');
  });

  test('Turkish shows only Turkish, and English shows no Turkish', async ({ page }) => {
    await open(page, { lang: 'tr' });
    await expect(page.getByTestId('hero-eyebrow')).toHaveText('YAPAY ZEKÂ DESTEKLİ KARBON MUHASEBESİ');   // (the page switches language just after it hydrates)
    const tr = await page.locator('.hero-root').innerText();
    expect(tr).toContain('YAPAY ZEKÂ DESTEKLİ KARBON MUHASEBESİ');
    expect(tr).toContain('Ölçün. Raporlayın.');
    expect(tr).toContain('Platformu Keşfedin');
    expect(tr).toContain('Kapsam 1');
    expect(tr).not.toMatch(/Measure\.|Explore Platform|Start Your Assessment|Direct Emissions|Scope 1|Purchased Energy/);
    await expect(page.getByTestId('hero-report')).toHaveAttribute('aria-label', /Örnek değerlerle/);
    const en = await (async () => { await open(page, { lang: 'en' }); return page.locator('.hero-root').innerText(); })();
    expect(en).not.toMatch(/Ölçün|Keşfedin|Kapsam|Raporlama/);
  });

  test('the headline is large and bold (32-64px) in the existing General Sans, in two unbroken lines; the sentence is restrained', async ({ page }) => {
    await open(page);
    const f = await page.evaluate(() => {
      const h = document.querySelector('.hero-h1');
      const cs = getComputedStyle(h);
      const lines = [...h.querySelectorAll('.hero-line')].map(l => { const r = document.createRange(); r.selectNodeContents(l.firstChild); return r.getClientRects().length; });
      return { size: parseFloat(cs.fontSize), weight: cs.fontWeight, family: cs.fontFamily, lines, p: parseFloat(getComputedStyle(document.querySelector('.hero-desc')).fontSize) };
    });
    expect(f.size).toBeGreaterThanOrEqual(32);
    expect(f.size).toBeLessThanOrEqual(64);
    expect(Number(f.weight)).toBeGreaterThanOrEqual(700);
    expect(f.family).toContain('General Sans');
    expect(f.lines).toEqual([1, 1]);                 // "Measure. Report." and "Reduce." are never broken
    expect(f.p).toBe(17);
    expect(f.p).toBeLessThan(f.size / 2.5);
  });
});

test.describe('background', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(async ({ page }) => { await reduceMotion(page); });

  test('is plain white: no gradient or tint on the hero or anything in it that spans a band', async ({ page }) => {
    await open(page);
    const f = await page.evaluate(() => {
      const root = document.querySelector('.hero-root');
      const all = [root, ...root.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 600; });   // anything wide
      return { rootBg: getComputedStyle(root).backgroundColor, rootImg: getComputedStyle(root).backgroundImage, wide: all.map(e => [String(e.getAttribute('class') || e.tagName), getComputedStyle(e).backgroundColor, getComputedStyle(e).backgroundImage]) };
    });
    expect(f.rootBg).toBe('rgb(255, 255, 255)');
    expect(f.rootImg).toBe('none');
    for (const [, color, img] of f.wide) { expect(img).toBe('none'); expect(['rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)']).toContain(color); }
  });

  test('the pixels around the hero are pure white (no colour boundary at the top, bottom or sides)', async ({ page }) => {
    await open(page);
    await page.waitForTimeout(1200);
    const root = await rect(page.locator('.hero-root'));
    const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 900 } });
    const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
    const px = (x, y) => { const i = (Math.round(y) * info.width + Math.round(x)) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
    // (the Header's own soft drop shadow falls on the first ~40px under it: that is the Header's, not the hero's, so start below it)
    const spots = [[20, root.y + 5], [20, root.y + 120], [20, root.b - 6], [700, root.b - 6], [1380, root.b - 6], [20, root.b + 6], [1400, root.y + 150]];
    for (const [x, y] of spots) expect(px(x, y), `pixel ${x},${Math.round(y)}`).toEqual([255, 255, 255]);
  });
});

test.describe('Scope cards', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(async ({ page }) => { await reduceMotion(page); });

  test('three cards with real, short text, standing left of the globe in an arc, in order, clear of it and of each other', async ({ page }) => {
    await open(page);
    const texts = { s1: ['Scope 1', 'Direct Emissions'], s2: ['Scope 2', 'Purchased Energy'], s3: ['Scope 3', 'Value Chain'] };
    const boxes = {};
    for (const [k, [title, sub]] of Object.entries(texts)) {
      const card = page.getByTestId(`hero-scope-${k}`).locator('.hero-card');
      await expect(card).toContainText(title);
      await expect(card).toContainText(sub);
      await expect(card.locator('.hero-card-text')).toHaveText(`${title} ${sub}`);     // exactly the title and the one short description, nothing more
      await expect(card.locator('.hero-card-sub')).toHaveCount(1);
      await expect(card.locator('.hero-card-icon svg')).toHaveCount(1);               // the green line icon
      expect((await rect(card)).h).toBeLessThan(64);                                   // compact: one line of description
      boxes[k] = await rect(card);
    }
    const e = await rect(page.getByTestId('hero-earth'));
    const gcx = e.x + ART.cx / ART.w * e.w;
    const bodyR = ART.bodyR / ART.w * e.w;
    for (const k of ['s1', 's2', 's3']) expect(boxes[k].r).toBeLessThan(gcx - bodyR);           // clear of the globe's body
    expect(boxes.s1.b).toBeLessThan(boxes.s2.y);
    expect(boxes.s2.b).toBeLessThan(boxes.s3.y);
    expect(boxes.s2.x).toBeLessThan(boxes.s1.x);                                                // the middle card stands furthest out: an arc
    expect(boxes.s2.x).toBeLessThan(boxes.s3.x);
  });

  test('a card opens a compact popover inside the window; Escape closes it', async ({ page }) => {
    await open(page);
    await page.getByTestId('hero-scope-s2').locator('button.hero-card').click();
    const pop = page.getByTestId('hero-scope-pop-s2');
    await expect(pop).toBeVisible();
    const b = await rect(pop);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.r).toBeLessThanOrEqual(1440);
    expect(b.y).toBeGreaterThanOrEqual(72);
    expect(overlaps(b, await rect(page.getByTestId('hero-report')))).toBe(false);
    await page.keyboard.press('Escape');
    await expect(pop).toHaveCount(0);
  });
});

test.describe('report preview', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(async ({ page }) => { await reduceMotion(page); });

  test('is a labelled SAMPLE with branding, title, ISO label, total, scope split, donut, monthly bars and period', async ({ page }) => {
    await open(page);
    const rep = page.getByTestId('hero-report');
    await expect(rep).toHaveAttribute('role', 'img');
    await expect(rep).toHaveAttribute('aria-label', /Sample carbon emission report with illustrative values/);
    const text = await rep.innerText();
    for (const s of ['Carbonless', 'Carbon Emission Report', 'ISO 14064-1', 'Total Emissions', 'Scope 1', 'Scope 2', 'Scope 3', 'Monthly Emissions', 'Reporting Period: Jan – Dec 2025', 'Sample report: illustrative values']) expect(text).toContain(s);
    await expect(rep.locator('svg.hero-report-donut circle')).toHaveCount(4);   // track + three segments
    await expect(rep.locator('.hero-report-bar')).toHaveCount(12);
    expect(text).toMatch(/Jan[\s\S]*Dec/);
  });

  test('the sample numbers add up (22,194 + 11,942 + 8,544 = 42,680; 52 + 28 + 20 = 100%)', async ({ page }) => {
    await open(page);
    const src = fs.readFileSync(path.join(process.cwd(), 'src/components/hero/heroContent.js'), 'utf8');
    const t = [...src.matchAll(/t: '([\d,]+)'/g)].map(m => Number(m[1].replace(',', '')));
    const pct = [...src.matchAll(/pct: (\d+)/g)].map(m => Number(m[1]));
    expect(t).toEqual([22194, 11942, 8544]);
    expect(t.reduce((a, b) => a + b, 0)).toBe(42680);
    expect(pct.reduce((a, b) => a + b, 0)).toBe(100);
    const text = await page.getByTestId('hero-report').innerText();
    expect(text).toContain('42,680');
    for (const p of ['52%', '28%', '20%']) expect(text).toContain(p);
  });

  test('is tilted (a restrained perspective), stands beside the Earth without covering it, the cards or the copy', async ({ page }) => {
    await open(page);
    const tr = await page.getByTestId('hero-report').evaluate(el => getComputedStyle(el).transform);
    expect(tr).toMatch(/^matrix3d/);                       // a real 3D tilt, not a flat box
    const rep = await rect(page.getByTestId('hero-report'));
    const earth = await rect(page.getByTestId('hero-earth'));
    const body = { cx: earth.x + ART.cx / ART.w * earth.w, r: ART.bodyR / ART.w * earth.w };
    expect(rep.x).toBeGreaterThan(body.cx + body.r + 8);   // clear of the globe's body
    for (const k of ['s1', 's2', 's3']) expect(overlaps(rep, await rect(page.getByTestId(`hero-scope-${k}`).locator('.hero-card')))).toBe(false);
    expect(overlaps(rep, await rect(page.locator('.hero-copy')))).toBe(false);
    expect(rep.r).toBeLessThanOrEqual(1440 - 16);
    expect(rep.w).toBeLessThan(earth.w);                   // never larger than the main visual
    expect(rep.h).toBeLessThan(earth.h + 20);
    expect(rep.w).toBeGreaterThan(200);                    // clearly visible: a readable size
  });
});

test.describe('motion', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the Earth floats (it does not turn), the rings turn, the content fades in', async ({ page }) => {
    await open(page);
    const names = (await heroAnims(page)).map(a => a.name);
    expect(names).toContain('hero-earth-float');
    expect(names).toContain('hero-spin');
    expect(names).toContain('hero-rise');
    expect(names).toContain('hero-rise-sm');
    expect(names).toContain('hero-fade');
    expect(names).toContain('hero-wheel');                    // the scroll cue's little wheel
    expect(names).not.toContain('hero-earth-spin');
    // the float is a few pixels at most
    const px = await page.getByTestId('hero-earth-spin').evaluate(el => { const a = el.getAnimations()[0]; a.pause(); a.currentTime = 9000; return new DOMMatrix(getComputedStyle(el).transform).f; });
    expect(Math.abs(px)).toBeLessThan(10);
  });

  test('durations are short and smooth (600-900ms entrances)', async ({ page }) => {
    await open(page);
    const d = await page.evaluate(() => document.getAnimations()
      .filter(a => a.effect?.target?.closest?.('.hero-root') && ['hero-rise', 'hero-rise-sm', 'hero-fade'].includes(a.animationName))
      .map(a => a.effect.getComputedTiming().duration));
    expect(d.length).toBeGreaterThanOrEqual(8);
    for (const x of d) { expect(x).toBeGreaterThanOrEqual(600); expect(x).toBeLessThanOrEqual(900); }
  });

  test('reduced motion: the finished picture, no animation of any kind, everything visible', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    await expect(page.locator('.hero-root')).toHaveAttribute('data-hero-motion', 'reduced');
    expect(await heroAnims(page)).toEqual([]);
    for (const sel of ['.hero-copy > *', '.hero-card', '.hero-report-sheet', '.hero-stage', '.hero-scroll']) {
      for (const o of await page.locator(sel).evaluateAll(els => els.map(e => getComputedStyle(e).opacity))) expect(o).toBe('1');
    }
  });

  test('everything pauses when the hero is scrolled away, and resumes', async ({ page }) => {
    await open(page);
    await expect(page.locator('.hero-root')).toHaveAttribute('data-hero-motion', 'on');
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.hero-root').offsetHeight + 1200));
    await expect(page.locator('.hero-root')).toHaveAttribute('data-hero-motion', 'paused');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('.hero-root')).toHaveAttribute('data-hero-motion', 'on');
  });

  test('nothing moves while the Earth loads: the same boxes before and after', async ({ page }) => {
    await reduceMotion(page);
    await page.route('**/globalnew-hero.webp', async route => { await new Promise(r => setTimeout(r, 600)); await route.continue(); });
    await page.addInitScript(() => { localStorage.setItem('language', 'en'); localStorage.setItem('language_explicit', '1'); });
    await page.goto('/');
    await expect(page.getByTestId('hero-h1')).toBeVisible();
    const sel = ['hero-earth', 'hero-report', 'hero-scopes'];
    const read = () => Promise.all(sel.map(s => rect(page.getByTestId(s))));
    const early = await read();
    await expect(page.getByTestId('hero-earth').locator('img')).toHaveJSProperty('complete', true);
    const late = await read();
    early.forEach((b, i) => { expect(Math.abs(b.y - late[i].y)).toBeLessThan(1); expect(Math.abs(b.x - late[i].x)).toBeLessThan(1); });
  });
});

test.describe('scroll cue', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a quiet mouse-shaped cue at the foot of the Hero, between it and About, with a short label', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    const cue = page.getByTestId('hero-scroll');
    await expect(cue).toBeVisible();
    await expect(cue).toHaveText('Scroll to explore');
    await expect(cue).toHaveAttribute('href', '#about');
    await expect(cue.locator('.hero-mouse')).toBeVisible();
    await expect(cue.locator('.hero-mouse-wheel')).toBeVisible();
    const c = await rect(cue), root = await rect(page.locator('.hero-root')), about = await rect(page.locator('#about'));
    expect(c.b).toBeLessThanOrEqual(root.b + 1);                                  // inside the Hero's foot ...
    expect(c.y).toBeGreaterThan(root.b - 140);
    expect(about.y).toBeGreaterThanOrEqual(root.b - 1);                           // ... and About begins right after it
    expect(overlaps(c, await rect(page.locator('.hero-copy')))).toBe(false);
    expect(overlaps(c, await rect(page.getByTestId('hero-earth')))).toBe(false);
    expect(overlaps(c, await rect(page.getByTestId('hero-report')))).toBe(false);
    expect(overlaps(c, await rect(page.locator('header')))).toBe(false);
    const color = await cue.evaluate(el => getComputedStyle(el).color);
    expect(color).not.toBe('rgb(17, 154, 46)');                                   // restrained grey, not a loud green
  });

  test('English and Turkish labels', async ({ page }) => {
    await open(page, { lang: 'tr' });
    await expect(page.getByTestId('hero-scroll')).toHaveText('Keşfetmek için kaydırın');
  });

  test('clicking it smoothly scrolls to the beginning of About', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.getByTestId('hero-scroll').click();
    await expect.poll(async () => Math.round((await rect(page.locator('#about'))).y), { timeout: 8000 }).toBeLessThanOrEqual(92);
    const about = await rect(page.locator('#about'));
    expect(about.y).toBeGreaterThanOrEqual(0);                                    // About's top is in view, just under the pinned Header
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(300);
    expect(await page.evaluate(() => location.hash)).toBe('#about');
  });

  test('reduced motion: it still works, with no animation', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    expect((await heroAnims(page)).filter(a => a.name === 'hero-wheel')).toEqual([]);
    await page.getByTestId('hero-scroll').click();
    await expect.poll(async () => Math.round((await rect(page.locator('#about'))).y), { timeout: 4000 }).toBeLessThanOrEqual(92);
  });

  test('keyboard: it is focusable and Enter scrolls to About', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    await page.getByTestId('hero-scroll').focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => Math.round((await rect(page.locator('#about'))).y), { timeout: 4000 }).toBeLessThanOrEqual(92);
  });
});

const SIZES = [[1920, 1080], [1440, 900], [1366, 768], [1280, 800], [1240, 800], [1024, 768], [820, 1100], [390, 844], [360, 740]];
test.describe('responsive', () => {
  for (const [width, height] of SIZES) {
    for (const lang of ['en', 'tr']) {
      test(`${lang} ${width}x${height}: no overflow, nothing clipped or colliding`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await reduceMotion(page);
        await open(page, { lang });
        const v = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, w: document.documentElement.clientWidth }));
        expect(v.over).toBeLessThanOrEqual(0);
        const copy = await rect(page.locator('.hero-copy'));
        const earth = await rect(page.getByTestId('hero-earth'));
        const rep = await rect(page.getByTestId('hero-report'));
        const cards = [];
        for (const k of ['s1', 's2', 's3']) cards.push(await rect(page.getByTestId(`hero-scope-${k}`).locator('.hero-card')));
        const cue = await rect(page.getByTestId('hero-scroll'));
        const about = await rect(page.locator('#about'));
        // the scroll cue: inside the window, centred, below everything in the hero and above About, covering nothing
        expect(cue.x).toBeGreaterThanOrEqual(0); expect(cue.r).toBeLessThanOrEqual(v.w);
        expect(Math.abs((cue.x + cue.r) / 2 - v.w / 2)).toBeLessThan(12);
        for (const b of [copy, earth, rep, ...cards]) expect(cue.y).toBeGreaterThanOrEqual(b.b - 1);
        expect(cue.b).toBeLessThanOrEqual(about.y + 1);
        // everything inside the window horizontally
        for (const b of [copy, rep, ...cards]) { expect(b.x).toBeGreaterThanOrEqual(-0.5); expect(b.r).toBeLessThanOrEqual(v.w + 0.5); }
        expect(earth.x).toBeGreaterThanOrEqual(0);
        expect(earth.r).toBeLessThanOrEqual(v.w);
        // no collisions
        expect(overlaps(copy, rep)).toBe(false);
        expect(overlaps(rep, earth)).toBe(false);
        // the copy's real ink: its text lines and its buttons (the column's own box also holds some empty space)
        const ink = await page.evaluate(() => {
          const out = []; const r = document.createRange();
          for (const el of document.querySelectorAll('.hero-eyebrow, .hero-line, .hero-desc')) { r.selectNodeContents(el); for (const k of r.getClientRects()) out.push({ x: k.x, y: k.y, r: k.right, b: k.bottom }); }
          for (const el of document.querySelectorAll('.hero-ctas > a')) { const k = el.getBoundingClientRect(); out.push({ x: k.x, y: k.y, r: k.right, b: k.bottom }); }
          return out;
        });
        for (const c of cards) { expect(overlaps(c, rep)).toBe(false); for (const k of ink) expect(overlaps(c, k, 4)).toBe(false); }
        for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(overlaps(cards[i], cards[j])).toBe(false);
        // the Earth stays prominent but large but moderate: 230-440px across on every screen
        expect(earth.w).toBeGreaterThan(230);
        expect(earth.w).toBeLessThan(440);
        // both buttons are fully visible and touch-sized
        for (const b of await page.locator('.hero-ctas > a').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { x: r.x, r: r.right, h: r.height }; }))) {
          expect(b.x).toBeGreaterThanOrEqual(0); expect(b.r).toBeLessThanOrEqual(v.w); expect(b.h).toBeGreaterThanOrEqual(44);
        }
        // the headline's lines are never broken
        const lines = await page.evaluate(() => [...document.querySelectorAll('.hero-line')].map(l => { const r = document.createRange(); r.selectNodeContents(l.firstChild); return r.getClientRects().length; }));
        expect(lines).toEqual([1, 1]);
        // the two buttons are one group, 52px under the sentence (it was 30px), with their own 10px gap and the same size as before
        const desc = await rect(page.locator('.hero-desc'));
        const ctaBoxes = await page.locator('.hero-ctas > a').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { y: r.y, h: r.height, x: r.x, r: r.right }; }));
        expect(Math.round(ctaBoxes[0].y - desc.b)).toBe(52);
        expect(ctaBoxes[0].h).toBe(48); expect(ctaBoxes[1].h).toBe(48);
        if (Math.abs(ctaBoxes[0].y - ctaBoxes[1].y) < 1) expect(Math.round(ctaBoxes[1].x - ctaBoxes[0].r)).toBe(10);       // side by side: the same 10px gap
        else expect(Math.round(ctaBoxes[1].y - (ctaBoxes[0].y + ctaBoxes[0].h))).toBe(10);                                // stacked on a phone: the same 10px gap
      });
    }
  }

  test('desktop: copy left, Earth middle, report right', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    const copy = await rect(page.locator('.hero-copy'));
    const earth = await rect(page.getByTestId('hero-earth'));
    const rep = await rect(page.getByTestId('hero-report'));
    expect(copy.r).toBeLessThan(earth.x);
    expect(earth.r).toBeLessThan(rep.x + 1);
  });

  test('phone: copy, then the Earth, then the cards, then the report', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    const ys = [];
    for (const loc of [page.locator('.hero-copy'), page.getByTestId('hero-earth'), page.getByTestId('hero-scopes'), page.getByTestId('hero-report')]) ys.push((await rect(loc)).y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    const ctas = await page.locator('.hero-ctas > a').evaluateAll(els => els.map(e => e.getBoundingClientRect().width));
    for (const w of ctas) expect(w).toBeGreaterThan(300);        // full-width, easy to tap
  });

  test('the whole hero fits a 1440x900 screen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await reduceMotion(page);
    await open(page);
    expect((await rect(page.locator('.hero-root'))).b).toBeLessThan(900);
  });
});
