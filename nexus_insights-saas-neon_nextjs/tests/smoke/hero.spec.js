/**
 * Smoke test — landing hero: the Earth, orbital rings and Scope cards.
 *
 * What it proves:
 *  - the Earth is public/globalnew-hero.webp (1254x1254, WebP with alpha: public/globalnew.png with its painted checkerboard cut to real
 *    transparency), drawn once, undistorted, its round body centred in the stage; it only turns slowly
 *  - a click enlarges it in place, subtly (~12%, no overlay); clicking it again, Escape or a click outside restores it
 *  - copy: eyebrow, two-line headline, supporting text, both calls to action (existing routes), scroll cue — EN / TR
 *  - the three Scope cards: real, localised text
 *  - the orbital rings: three rings + a tick scale, glowing nodes, turning smoothly; reduced motion removes all
 *    motion; the hero pauses off screen / in a hidden tab
 *  - responsive: 360-1920px, no horizontal overflow, nothing clipped, cards clear of each other, the globe and the copy
 *  - no layout shift while the Earth loads
 *
 * The landing page needs no backend. Geometry of globalnew-hero.webp (measured on the file): canvas 1254x1254,
 * visible art x 18-1235, y 0-1247; its round body (the ring of trees) is centred on (629.5, 640.5), radius 604.5;
 * smoke and turbine tips stand above it, so the art's bounding box is not centred on the globe.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ART = { w: 1254, h: 1254, cx: 629.5, cy: 640.5, bodyR: 604.5, top: 0, bottom: 1247, left: 18, right: 1235 };

async function open(page, { lang = 'en' } = {}) {
  await page.addInitScript(l => {
    localStorage.setItem('language', l);
    localStorage.setItem('language_explicit', '1');
  }, lang);
  await page.goto('/');
  await expect(page.getByTestId('hero-h1')).toBeVisible();
  await expect(page.getByTestId('hero-earth').locator('img')).toBeVisible();
}

/** Reduced motion, for real: `test.use({ reducedMotion })` is not applied in this setup, so emulate it. */
const reduceMotion = page => page.emulateMedia({ reducedMotion: 'reduce' });
async function expectReduced(page) {
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await expect(page.locator('.hero-root')).toHaveAttribute('data-hero-motion', 'reduced');
}

const heroAnims = page => page.evaluate(() => document.getAnimations()
  .filter(a => a.effect?.target?.closest?.('.hero-root'))
  .map(a => ({ cls: String(a.effect.target.getAttribute('class')), name: a.animationName, state: a.playState, infinite: a.effect.getComputedTiming().iterations === Infinity })));

/** Boxes, in window px: the Earth image, the globe's visible circle, the stage, the cards, the copy's text and buttons. */
async function geometry(page) {
  return page.evaluate(A => {
    const r = el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    const text = el => { const g = document.createRange(); g.selectNodeContents(el); return r(g); };
    const img = r(document.querySelector('[data-testid="hero-earth"]'));
    const k = img.w / A.w;
    const stage = r(document.querySelector('[data-testid="hero-stage"]'));
    const cards = Object.fromEntries(['s1', 's2', 's3'].map(key => [key, r(document.querySelector(`[data-testid="hero-scope-${key}"] .hero-card`))]));
    return {
      img,
      globe: { x: img.x + A.cx * k, y: img.y + A.cy * k, r: A.bodyR * k },
      stage, cards,
      eyebrow: text(document.querySelector('.hero-eyebrow')),
      lines: [...document.querySelectorAll('.hero-line')].map(text),
      desc: text(document.querySelector('.hero-desc')),
      ctas: [...document.querySelectorAll('.hero-ctas > a')].map(r),
      scroll: r(document.querySelector('[data-testid="hero-scroll"]')),
      root: r(document.querySelector('.hero-root')),
      viewW: document.documentElement.clientWidth, viewH: window.innerHeight,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    };
  }, ART);
}

/** Distance (px) from the globe's centre to the nearest point of a box, minus the given radius (>0 = clear). */
const clearance = (c, box, radius = c.r) => {
  const nx = Math.max(box.x, Math.min(c.x, box.r)), ny = Math.max(box.y, Math.min(c.y, box.b));
  return Math.hypot(nx - c.x, ny - c.y) - radius;
};
const overlaps = (a, b, pad = 0) => a.x < b.r + pad && a.r > b.x - pad && a.y < b.b + pad && a.b > b.y - pad;

test.describe('the Earth', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(async ({ page }) => { await reduceMotion(page); });

  test('is public/globalnew-hero.webp, the only picture in the hero, drawn undistorted', async ({ page }) => {
    const requested = [];
    page.on('request', rq => requested.push(decodeURIComponent(new URL(rq.url()).pathname + new URL(rq.url()).search)));
    await open(page);
    const info = await page.evaluate(() => {
      const img = document.querySelector('[data-testid="hero-earth"] img');
      const b = document.querySelector('[data-testid="hero-earth"]').getBoundingClientRect();
      return { src: decodeURIComponent(img.currentSrc), nw: img.naturalWidth, nh: img.naturalHeight, w: b.width, h: b.height, count: document.querySelectorAll('.hero-root img').length, alt: img.getAttribute('alt') };
    });
    expect(info.src).toContain('globalnew-hero.webp');
    expect([info.nw, info.nh]).toEqual([ART.w, ART.h]);
    expect(info.count).toBe(1);
    expect(info.alt).toBe('');                                    // decorative: the headline carries the meaning
    expect(Math.abs(info.w / info.h - ART.w / ART.h)).toBeLessThan(0.005);   // aspect ratio preserved
    // the previous artwork is no longer requested
    expect(requested.filter(u => /herosection|newsoil|soil\.|\/earth\.png|globalnew-hero\.png/.test(u))).toEqual([]);   // nor the 4.4 MB PNG
    // the picture is a WebP with a real alpha channel, the same size as the original it was made from; both files are kept
    const meta = await sharp(path.join(process.cwd(), 'public', 'globalnew-hero.webp')).metadata();
    expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual(['webp', ART.w, ART.h, true]);
    expect(fs.statSync(path.join(process.cwd(), 'public', 'globalnew-hero.webp')).size).toBeLessThan(1024 * 1024);
    const orig = await sharp(path.join(process.cwd(), 'public', 'globalnew.png')).metadata();
    expect([orig.format, orig.width, orig.height]).toEqual(['png', ART.w, ART.h]);
  });

  test('is placed by its visible art: the globe\'s round body is centred on the stage and the art fits inside it', async ({ page }) => {
    await open(page);
    const m = await page.evaluate(async () => {
      const img = document.querySelector('[data-testid="hero-earth"] img');
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1, clear = 0;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const a = d[(y * c.width + x) * 4 + 3];
        if (a === 0) clear++;
        if (a > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      return { x0, y0, x1, y1, clearFrac: clear / (c.width * c.height) };
    });
    // real transparency, and the measured art bounds
    expect(m.clearFrac).toBeGreaterThan(0.3);
    expect(Math.abs(m.x0 - ART.left)).toBeLessThan(4); expect(Math.abs(m.x1 - ART.right)).toBeLessThan(4);
    expect(Math.abs(m.y0 - ART.top)).toBeLessThan(4); expect(Math.abs(m.y1 - ART.bottom)).toBeLessThan(4);

    const g = await geometry(page);
    const k = g.img.w / ART.w;
    // the smoke and turbines make the art's bounding box taller than the globe, so the rings are centred on the round
    // body (the ring of trees), not on that box: its centre (ART.cx, ART.cy) is on the stage centre
    expect(Math.abs(g.globe.x - (g.stage.x + g.stage.w / 2))).toBeLessThan(g.stage.w * 0.006);
    expect(Math.abs(g.globe.y - (g.stage.y + g.stage.h / 2))).toBeLessThan(g.stage.h * 0.01);
    // ...and the measured art agrees: its left and right edges are (almost) symmetric about that centre
    expect(Math.abs((m.x0 + m.x1) / 2 - ART.cx)).toBeLessThan(8);
    // the visible art is ~74% of the stage's height (474 of 640 units), so it dominates it without touching the edge
    const artH = (m.y1 - m.y0) * k;
    expect(artH / g.stage.h).toBeGreaterThan(0.70);
    expect(artH / g.stage.h).toBeLessThan(0.80);
    expect(g.img.y + m.y0 * k).toBeGreaterThanOrEqual(g.stage.y);
    expect(g.img.y + m.y1 * k).toBeLessThanOrEqual(g.stage.b);
  });

  test('turns slowly and smoothly clockwise about the centre of its art; only the picture turns', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    const spin = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="hero-earth-spin"]');
      const a = el.getAnimations()[0], t = a.effect.getComputedTiming(), cs = getComputedStyle(el);
      const w = el.getBoundingClientRect(), [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat);
      return { name: a.animationName, duration: t.duration, infinite: t.iterations === Infinity, direction: t.direction, easing: cs.animationTimingFunction,
               // layout box of the (unrotated) element, so its size is not the rotated bounding box
               originX: ox / el.offsetWidth, originY: oy / el.offsetHeight };
    });
    expect(spin.name).toBe('hero-earth-spin');
    expect(spin.infinite).toBe(true);
    expect(spin.direction).toBe('normal');
    expect(spin.easing).toBe('linear');
    expect(spin.duration).toBeGreaterThanOrEqual(90_000);                       // one lap in 90-120 s: drift, not spin
    expect(spin.duration).toBeLessThanOrEqual(120_000);
    // about the centre of the globe's round body (629.5, 640.5 of 1254 x 1254)
    expect(Math.abs(spin.originX - ART.cx / ART.w)).toBeLessThan(0.002);
    expect(Math.abs(spin.originY - ART.cy / ART.h)).toBeLessThan(0.002);

    // clockwise (the angle grows on screen) and gently: about 5 degrees in 1.5 s
    const angle = () => page.evaluate(() => { const m = new DOMMatrix(getComputedStyle(document.querySelector('[data-testid="hero-earth-spin"]')).transform); return Math.atan2(m.b, m.a) * 180 / Math.PI; });
    const box = () => page.evaluate(() => ['[data-testid="hero-earth"]', '[data-testid="hero-earth-btn"]', '[data-testid="hero-stage"]', '[data-testid="hero-scope-s1"] .hero-card', '[data-testid="hero-scope-s2"]']
      .map(s => { const b = document.querySelector(s).getBoundingClientRect(); return [b.x, b.width, b.width]; }));
    const a1 = await angle(), b1 = await box();
    await page.waitForTimeout(1500);
    const a2 = await angle(), b2 = await box();
    let delta = a2 - a1; if (delta < -180) delta += 360;
    expect(delta).toBeGreaterThan(2);
    expect(delta).toBeLessThan(9);
    // the Earth's box, its button, the stage and the cards do not turn (cards only float vertically)
    expect(b2).toEqual(b1);
    expect(await page.evaluate(() => ['.hero-earth', '.hero-stage', '.hero-visual', '.hero-copy', '.hero-cards', '.hero-orbits', '.hero-root']
      .map(s => getComputedStyle(document.querySelector(s)).transform))).toEqual(Array(7).fill('none'));
    // the button is only centred (a translate), never turned
    const m = await page.evaluate(() => { const t = new DOMMatrix(getComputedStyle(document.querySelector('[data-testid="hero-earth-btn"]')).transform); return [t.a, t.b, t.c, t.d]; });
    expect(m).toEqual([1, 0, 0, 1]);
    // nothing else is the Earth's ancestor-in-rotation: the rings, cards and labels are not inside the turning element
    expect(await page.locator('[data-testid="hero-earth-spin"] .hero-card, [data-testid="hero-earth-spin"] .hero-orbits').count()).toBe(0);
    expect(await page.evaluate(() => document.querySelector('[data-testid="hero-earth-spin"]').children.length)).toBe(1);   // just the picture
  });

  test('the turning art never reaches the tick scale (the farthest opaque pixel is inside it)', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    const m = await page.evaluate(A => {
      const img = document.querySelector('[data-testid="hero-earth"] img');
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let far = 0;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) far = Math.max(far, Math.hypot(x - A.cx, y - A.cy));
      const tick = document.querySelector('[data-testid="hero-ticks"] circle').getBoundingClientRect();
      const earth = document.querySelector('[data-testid="hero-earth"]').getBoundingClientRect();
      return { far, tickR: tick.width / 2, k: earth.width / A.w };
    }, ART);
    expect(m.far).toBeGreaterThan(560);
    // the tick marks are 10 units wide about r258: the innermost edge is 253 of 258
    const innerEdge = m.tickR * (253 / 258);
    expect(m.far * m.k).toBeLessThan(innerEdge);
  });
});

/** Click the Earth (the path most people use); the enlargement is in place, so these read its state off the page. */
const openEarth = page => page.getByTestId('hero-earth-btn').click();
const isZoomed = page => page.getByTestId('hero-earth').getAttribute('data-zoomed');
/** wait for the 0.55 s scale transition to settle */
const settle = page => page.waitForTimeout(700);

test.describe('click to enlarge the Earth (subtly, in place)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('grows only ~12% about its own centre, undistorted, with no overlay; the page stays usable', async ({ page }) => {
    await reduceMotion(page);                                                   // the cards float; hold them still to compare their boxes
    await open(page);
    const before = await geometry(page);
    const url = page.url();
    await openEarth(page);
    await expect(page.getByTestId('hero-earth')).toHaveAttribute('data-zoomed', 'true');
    await expect(page.getByTestId('hero-earth-btn')).toHaveAttribute('aria-pressed', 'true');
    expect(page.url()).toBe(url);                                               // no navigation
    await settle(page);
    const after = await geometry(page);
    // 10-15% larger, the same proportions, the same centre
    const grow = after.img.w / before.img.w;
    expect(grow).toBeGreaterThanOrEqual(1.10); expect(grow).toBeLessThanOrEqual(1.15);
    expect(Math.abs(after.img.w / after.img.h - ART.w / ART.h)).toBeLessThan(0.005);
    expect(Math.abs(after.globe.x - before.globe.x)).toBeLessThan(1.5);
    expect(Math.abs(after.globe.y - before.globe.y)).toBeLessThan(1.5);
    // no modal, no dimmed backdrop, no scroll lock: just the picture, a little larger
    expect(await page.locator('dialog[open]').count()).toBe(0);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');
    // it stays clear of the navigation and the Scope cards, and inside the stage and the window
    const header = await page.locator('header').first().boundingBox();
    const stage = after.stage;
    expect(after.img.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(after.img.y).toBeGreaterThanOrEqual(stage.y - 1); expect(after.img.b).toBeLessThanOrEqual(stage.b + 1);
    expect(after.img.x).toBeGreaterThanOrEqual(0); expect(after.img.r).toBeLessThanOrEqual(after.viewW);
    for (const c of Object.values(after.cards)) expect(overlaps(after.img, c)).toBe(false);
    // ...and the copy below it does not move
    expect(after.lines).toEqual(before.lines);
    expect(after.cards).toEqual(before.cards);
  });

  test('uses a smooth, short transform transition', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    const t = await page.getByTestId('hero-earth').evaluate(el => { const cs = getComputedStyle(el); return { prop: cs.transitionProperty, dur: parseFloat(cs.transitionDuration) }; });
    expect(t.prop).toBe('transform');
    expect(t.dur).toBeGreaterThanOrEqual(0.3); expect(t.dur).toBeLessThanOrEqual(0.8);
  });

  for (const how of ['a second click on the Earth', 'Escape', 'a click outside the Earth']) {
    test(`returns to its normal size with ${how}; focus stays on the Earth`, async ({ page }) => {
      await reduceMotion(page);
      await open(page);
      const normal = (await geometry(page)).img;
      await page.getByTestId('hero-earth-btn').focus();
      await page.keyboard.press('Enter');                                       // the keyboard opens it too
      await expect(page.getByTestId('hero-earth')).toHaveAttribute('data-zoomed', 'true');
      if (how === 'a second click on the Earth') await openEarth(page);
      else if (how === 'Escape') await page.keyboard.press('Escape');
      else await page.mouse.click(40, 450);
      await expect(page.getByTestId('hero-earth')).toHaveAttribute('data-zoomed', 'false');
      await expect(page.getByTestId('hero-earth-btn')).toHaveAttribute('aria-pressed', 'false');
      expect((await geometry(page)).img).toEqual(normal);
      if (how !== 'a click outside the Earth') await expect(page.getByTestId('hero-earth-btn')).toBeFocused();
    });
  }

  test('only the globe enlarges it: the rings, the space around the globe and the cards do not', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    const g = await geometry(page);
    // between the art and the tick scale, on a ring, and on a node
    await page.mouse.click(g.globe.x + g.globe.r * 1.07, g.globe.y);
    await page.mouse.click(g.globe.x, g.globe.y - g.globe.r * 1.12);
    expect(await isZoomed(page)).toBe('false');
    // the Earth's button is the round disc over the globe's body, centred on it
    const btn = await page.getByTestId('hero-earth-btn').boundingBox();
    expect(Math.abs(btn.x + btn.width / 2 - g.globe.x)).toBeLessThan(2);
    expect(Math.abs(btn.y + btn.height / 2 - g.globe.y)).toBeLessThan(2);
    expect(Math.abs(btn.width / 2 - g.globe.r)).toBeLessThan(2);
    expect(await page.getByTestId('hero-earth-btn').evaluate(el => getComputedStyle(el).borderRadius)).toBe('50%');
    // a card keeps its own click, not the Earth's
    await page.getByTestId('hero-scope-s1').locator('button').click({ force: true });
    await expect(page.getByTestId('hero-scope-pop-s1')).toBeVisible();
    expect(await isZoomed(page)).toBe('false');
  });

  test('English and Turkish labels', async ({ page }) => {
    await open(page, { lang: 'tr' });
    await expect(page.getByTestId('hero-earth-btn')).toHaveAttribute('aria-label', 'Dünya görselini büyüt');
    await expect(page.getByTestId('hero-earth-btn')).toHaveAttribute('aria-pressed', 'false');
  });

  test('reduced motion: it changes size at once, nothing animates', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    const w0 = (await geometry(page)).img.w;
    await openEarth(page);
    expect((await geometry(page)).img.w / w0).toBeGreaterThanOrEqual(1.10);   // no wait needed: no transition
    expect(await heroAnims(page)).toEqual([]);
    expect(await page.getByTestId('hero-earth').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  });
});

const popOf = (page, key) => page.getByTestId(`hero-scope-pop-${key}`);
const cardBtn = (page, key) => page.getByTestId(`hero-scope-${key}`).locator('button.hero-card');
/** boxes (window px) of a popover, its card and the other two cards' slots */
const popGeometry = (page, key) => page.evaluate(k => {
  const r = el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const others = ['s1', 's2', 's3'].filter(o => o !== k).map(o => r(document.querySelector(`[data-testid="hero-scope-${o}"] .hero-card`)));
  const pop = document.querySelector(`[data-testid="hero-scope-pop-${k}"]`);
  return { pop: r(pop), mode: pop.dataset.mode, side: pop.dataset.side, card: r(document.querySelector(`[data-testid="hero-scope-${k}"] .hero-card`)), others,
           viewW: document.documentElement.clientWidth, viewH: window.innerHeight, overflowX: document.documentElement.scrollWidth - window.innerWidth };
}, key);
/** shortest distance between two boxes (0 = touching or overlapping) */
const gapBetween = (a, b) => Math.hypot(Math.max(a.x - b.r, b.x - a.r, 0), Math.max(a.y - b.b, b.y - a.b, 0));

test.describe('Scope popover (small, next to the card)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  const WORDS = {
    en: { sections: ['Examples in a factory', 'Why it matters'], other: ['Fabrikadan', 'Neden önemli'] },
    tr: { sections: ['Fabrikadan örnekler', 'Neden önemli?'], other: ['Examples in a factory', 'Why it matters'] },
  };
  const TITLES = {
    en: { s1: 'Direct emissions from operations', s2: 'Indirect emissions from purchased electricity, steam, heating and cooling', s3: 'Other indirect value-chain emissions' },
    tr: { s1: 'Operasyonlardan doğrudan emisyonlar', s2: 'Satın alınan elektrik, buhar, ısıtma ve soğutmadan kaynaklanan dolaylı emisyonlar', s3: 'Değer zincirindeki diğer dolaylı emisyonlar' },
  };
  const KEYWORDS = {
    en: { s1: ['boiler', 'forklifts', 'Refrigerant'], s2: ['electricity', 'steam', 'location-based'], s3: ['suppliers', 'supply chain', 'step by step'] },
    tr: { s1: ['kazan', 'forklift', 'soğutucu akışkan'], s2: ['elektrik', 'buhar', 'konum bazlı'], s3: ['tedarikçi', 'tedarik zincirinde', 'adım adım'] },
  };

  for (const lang of ['en', 'tr']) {
    for (const key of ['s1', 's2', 's3']) {
      test(`${lang} ${key}: the card opens a compact popover beside it, in the visitor's language`, async ({ page }) => {
        await reduceMotion(page);
        await open(page, { lang });
        const url = page.url();
        await expect(cardBtn(page, key)).toHaveAttribute('aria-expanded', 'false');
        await cardBtn(page, key).click({ force: true });
        const pop = popOf(page, key);
        await expect(pop).toBeVisible();
        await expect(cardBtn(page, key)).toHaveAttribute('aria-expanded', 'true');
        expect(page.url()).toBe(url);                                                       // no navigation
        await expect(page.getByRole('dialog', { name: TITLES[lang][key] })).toBeVisible();   // named by its title
        await expect(pop).toHaveAttribute('aria-modal', 'false');                           // not a modal
        expect(await page.locator('dialog[open]').count()).toBe(0);
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');   // the page keeps scrolling
        const text = await pop.textContent();                                              // (the small headings are upper-cased by CSS)
        for (const s of WORDS[lang].sections) expect(text).toContain(s);
        for (const o of WORDS[lang].other) expect(text).not.toContain(o);
        for (const w of KEYWORDS[lang][key]) expect(text.toLowerCase()).toContain(w.toLowerCase());
        expect(await pop.locator('li').count()).toBe(3);                                    // a few factory examples
        for (const bad of ['Carbonless calculates', 'certified', 'guarantee', 'sertifika']) expect(text).not.toContain(bad);
        // compact, beside its card, inside the window, never over another card or the card itself
        const g = await popGeometry(page, key);
        expect(g.mode).toBe('wide');
        expect(g.pop.w).toBeLessThanOrEqual(350); expect(g.pop.h).toBeLessThan(470);
        expect(g.pop.x).toBeGreaterThanOrEqual(0); expect(g.pop.r).toBeLessThanOrEqual(g.viewW);
        expect(g.pop.y).toBeGreaterThanOrEqual(72); expect(g.pop.b).toBeLessThanOrEqual(g.viewH);
        expect(gapBetween(g.pop, g.card)).toBeLessThan(30);                                 // right next to the card
        expect(overlaps(g.pop, g.card)).toBe(false);
        for (const o of g.others) expect(overlaps(g.pop, o, 2)).toBe(false);
      });
    }
  }

  test('clicking another card switches the popover; clicking the same card again closes it', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    for (const key of ['s1', 's2', 's3', 's1']) {
      await cardBtn(page, key).click({ force: true });
      await expect(popOf(page, key)).toBeVisible();
      expect(await page.locator('.hero-pop').count()).toBe(1);
      for (const k of ['s1', 's2', 's3']) await expect(cardBtn(page, k)).toHaveAttribute('aria-expanded', String(k === key));
    }
    await cardBtn(page, 's1').click({ force: true });
    await expect(page.locator('.hero-pop')).toHaveCount(0);
    await expect(cardBtn(page, 's1')).toHaveAttribute('aria-expanded', 'false');
  });

  for (const how of ['the close button', 'Escape', 'a click outside']) {
    test(`closes with ${how}`, async ({ page }) => {
      await reduceMotion(page);
      await open(page);
      await cardBtn(page, 's2').focus();
      await page.keyboard.press('Enter');
      await expect(popOf(page, 's2')).toBeVisible();
      if (how === 'the close button') { await page.getByTestId('hero-pop-close').click(); await expect(cardBtn(page, 's2')).toBeFocused(); }
      else if (how === 'Escape') await page.keyboard.press('Escape');
      else await page.mouse.click(60, 700);
      await expect(page.locator('.hero-pop')).toHaveCount(0);
      await expect(cardBtn(page, 's2')).toHaveAttribute('aria-expanded', 'false');
      expect(await page.locator('dialog[open]').count()).toBe(0);
    });
  }

  test('a click inside the popover does not close it', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    await cardBtn(page, 's3').click({ force: true });
    await popOf(page, 's3').locator('.hero-pop-text').first().click();
    await expect(popOf(page, 's3')).toBeVisible();
  });

  test('keyboard: Enter and Space open it, focus stays on the card, Escape closes; Tab reaches the popover and leaves it (no trap)', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    const ring = async () => page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return [cs.outlineStyle, parseFloat(cs.outlineWidth)]; });
    // Tab to the first card (visible focus ring)
    let found = false;
    for (let i = 0; i < 40 && !found; i++) { await page.keyboard.press('Tab'); found = await page.evaluate(() => !!document.activeElement.closest('[data-testid="hero-scope-s1"]')); }
    expect(found).toBe(true);
    const r = await ring(); expect(r[0]).not.toBe('none'); expect(r[1]).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Enter');
    await expect(popOf(page, 's1')).toBeVisible();
    await expect(cardBtn(page, 's1')).toBeFocused();                                         // focus is not stolen
    // Tab on through the other cards to the popover's close button, then past it
    const seen = new Set();
    for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); seen.add(await page.evaluate(() => (document.activeElement.closest('.hero-pop') ? 'pop' : document.activeElement.closest('[data-testid^="hero-scope-"]') ? 'card' : 'other'))); }
    expect(seen.has('pop')).toBe(true);
    expect(seen.has('other')).toBe(true);                                                    // focus is free to leave
    // Escape from inside the popover: back on its card
    await page.getByTestId('hero-pop-close').focus();
    expect((await ring())[1]).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Escape');
    await expect(page.locator('.hero-pop')).toHaveCount(0);
    await expect(cardBtn(page, 's1')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(popOf(page, 's1')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.hero-pop')).toHaveCount(0);
    await expect(cardBtn(page, 's1')).toBeFocused();
  });

  test('the Earth still enlarges itself, and that closes the popover', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    await cardBtn(page, 's2').click({ force: true });
    await expect(popOf(page, 's2')).toBeVisible();
    await page.getByTestId('hero-earth-btn').click({ position: { x: 50, y: 250 } });       // the part of the globe the popover does not cover
    await expect(page.getByTestId('hero-earth')).toHaveAttribute('data-zoomed', 'true');
    await expect(page.locator('.hero-pop')).toHaveCount(0);
  });

  test('reduced motion: no animation; with motion: a short fade/scale', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    await cardBtn(page, 's2').click({ force: true });
    await expect(popOf(page, 's2')).toBeVisible();
    expect(await popOf(page, 's2').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();
    await expect(page.getByTestId('hero-h1')).toBeVisible();
    await cardBtn(page, 's2').click({ force: true });
    const a = await popOf(page, 's2').evaluate(el => { const cs = getComputedStyle(el); return [cs.animationName, parseFloat(cs.animationDuration)]; });
    expect(a[0]).toBe('hero-pop-in'); expect(a[1]).toBeLessThanOrEqual(0.25);
  });
});

test.describe('the Scope cards are compact', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('about 15-20% smaller than before (was ~222 x 84 px, 16 / 12.5 px text, 38 px icon), still glass-white and consistent', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    const m = await page.evaluate(() => ['s1', 's2', 's3'].map(k => {
      const card = document.querySelector(`[data-testid="hero-scope-${k}"] .hero-card`), b = card.getBoundingClientRect();
      const fs = s => parseFloat(getComputedStyle(card.querySelector(s)).fontSize);
      const icon = card.querySelector('.hero-card-icon').getBoundingClientRect();
      return { w: b.width, h: b.height, title: fs('.hero-card-title'), sub: fs('.hero-card-sub'), icon: icon.width, pad: parseFloat(getComputedStyle(card).paddingLeft), radius: getComputedStyle(card).borderRadius,
               bg: getComputedStyle(card).backgroundImage, blur: getComputedStyle(card).backdropFilter };
    }));
    for (const c of m) {
      expect(c.w).toBeLessThanOrEqual(222 * 0.88); expect(c.w).toBeGreaterThanOrEqual(160);
      expect(c.h).toBeLessThanOrEqual(88);                                                  // (Scope 2's text takes three lines)
      expect(c.title).toBeLessThanOrEqual(16 * 0.88); expect(c.title).toBeGreaterThanOrEqual(13);   // the title stays prominent
      expect(c.sub).toBeLessThanOrEqual(12.5 * 0.9); expect(c.sub).toBeGreaterThanOrEqual(11);      // and the description readable
      expect(c.icon).toBeLessThanOrEqual(38 * 0.85);
      expect(c.bg).toContain('rgba(255, 255, 255'); expect(c.blur).toContain('blur');
    }
    // consistent: same type sizes, icon, radius and padding on all three
    for (const k of ['title', 'sub', 'icon', 'pad', 'radius']) expect(new Set(m.map(c => c[k])).size).toBe(1);
  });
});

test.describe('Scope popover at every size', () => {
  const sizes = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 820, height: 1180 },
    { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];
  for (const lang of ['en', 'tr']) {
    for (const s of sizes) {
      test(`${lang} ${s.width}x${s.height}: each popover stays inside the window, clear of the other cards, no overflow`, async ({ page }) => {
        await page.setViewportSize(s);
        await reduceMotion(page);
        await open(page, { lang });
        const wide = s.width >= 1024;
        for (const key of ['s1', 's2', 's3']) {
          await cardBtn(page, key).scrollIntoViewIfNeeded();
          await cardBtn(page, key).click({ force: true });
          await expect(popOf(page, key)).toBeVisible();
          await page.waitForTimeout(120);
          const g = await popGeometry(page, key);
          expect(g.mode).toBe(wide ? 'wide' : s.width >= 600 ? 'tablet' : 'phone');
          expect(g.overflowX).toBeLessThanOrEqual(0);
          expect(g.pop.x).toBeGreaterThanOrEqual(0); expect(g.pop.r).toBeLessThanOrEqual(g.viewW);
          expect(g.pop.y).toBeGreaterThanOrEqual(wide ? 72 : 0); expect(g.pop.b).toBeLessThanOrEqual(g.viewH + 1);
          for (const o of g.others) expect(overlaps(g.pop, o, 0)).toBe(false);
          expect(overlaps(g.pop, g.card, 0)).toBe(false);
          if (wide) { expect(g.pop.w).toBeLessThanOrEqual(350); expect(gapBetween(g.pop, g.card)).toBeLessThan(30); }
          else { expect(g.pop.y).toBeGreaterThanOrEqual(g.card.b - 1); expect(g.pop.y - g.card.b).toBeLessThan(20); }   // directly under the card (phones) / its row (tablets)
          const clipped = await popOf(page, key).evaluate(el => [...el.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').length);
          expect(clipped).toBe(0);
          // the other cards stay reachable: every card is still where it was and clickable
          await page.keyboard.press('Escape');
          await expect(page.locator('.hero-pop')).toHaveCount(0);
        }
      });
    }
  }
});

test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const s of [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 820, height: 1180 }]) {
    test(`${s.width}: tap opens the popover under the card, in reach; tap outside or the close button closes it`, async ({ page }) => {
      await page.setViewportSize(s);
      await reduceMotion(page);
      await open(page);
      for (const key of ['s1', 's2', 's3']) {
        await cardBtn(page, key).scrollIntoViewIfNeeded();
        const cb = await cardBtn(page, key).boundingBox();
        expect(cb.height).toBeGreaterThanOrEqual(44);
        await cardBtn(page, key).tap();
        await expect(popOf(page, key)).toBeVisible();
        await page.waitForTimeout(150);
        const g = await popGeometry(page, key);
        expect(g.pop.b).toBeLessThanOrEqual(g.viewH + 1); expect(g.pop.r).toBeLessThanOrEqual(g.viewW);
        const close = await page.getByTestId('hero-pop-close').boundingBox();
        expect(close.width).toBeGreaterThanOrEqual(36); expect(close.height).toBeGreaterThanOrEqual(36);
        if (key === 's1') await page.getByTestId('hero-pop-close').tap();
        else if (key === 's2') await page.touchscreen.tap(s.width - 4, 90);       // outside: the top-right corner of the page, above the hero art
        else await cardBtn(page, 's3').tap();                                      // the same card again
        await expect(page.locator('.hero-pop')).toHaveCount(0);
      }
      // switching by tapping another card
      await cardBtn(page, 's1').tap();
      await cardBtn(page, 's2').scrollIntoViewIfNeeded();
      await cardBtn(page, 's2').tap();
      await expect(popOf(page, 's2')).toBeVisible();
      expect(await page.locator('.hero-pop').count()).toBe(1);
    });
  }
});


test.describe('copy and calls to action', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(async ({ page }) => { await reduceMotion(page); });

  test('English: eyebrow, headline, text, both buttons, scroll cue — and the old layout is gone', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('hero-eyebrow')).toHaveText('MEASURE TODAY. A CLEANER TOMORROW.');
    await expect(page.locator('.hero-line')).toHaveText(['Your Carbon Footprint.', 'Under Control.']);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your Carbon Footprint. Under Control.');
    await expect(page.getByText('AI-powered carbon accounting for factories and industrial businesses.')).toBeVisible();
    await expect(page.getByText('Turn complex data into clear insights and take real action.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Calculate Your Carbon Footprint' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'See How It Works' })).toBeVisible();
    await expect(page.getByTestId('hero-scroll')).toContainText('Scroll to explore');
    // "Under Control." is the green line
    expect(await page.locator('.hero-line').nth(1).evaluate(el => getComputedStyle(el).color)).toBe('rgb(17, 154, 46)');
    // the previous left-text / right-list composition is gone
    await expect(page.getByTestId('hero-points')).toHaveCount(0);
    await expect(page.getByTestId('hero-soil')).toHaveCount(0);
  });

  test('Turkish shows only Turkish', async ({ page }) => {
    await open(page, { lang: 'tr' });
    await expect(page.getByTestId('hero-eyebrow')).toHaveText('BUGÜN ÖLÇÜN. YARIN DAHA TEMİZ.');
    await expect(page.locator('.hero-line')).toHaveText(['Karbon Ayak İziniz.', 'Kontrol Altında.']);
    await expect(page.getByRole('link', { name: 'Karbon Ayak İzinizi Hesaplayın' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nasıl Çalışır?' })).toBeVisible();
    await expect(page.getByTestId('hero-scroll')).toContainText('Keşfetmek için kaydırın');
    const tr = await page.locator('.hero-root').innerText();
    for (const en of ['MEASURE TODAY', 'Under Control', 'See How It Works', 'Scroll to explore', 'AI-powered', 'Scope', 'Direct Emissions']) expect(tr).not.toContain(en);
  });

  test('English shows no Turkish', async ({ page }) => {
    await open(page, { lang: 'en' });
    const en = await page.locator('.hero-root').innerText();
    for (const tr of ['BUGÜN', 'Kontrol Altında', 'Nasıl Çalışır', 'Kapsam', 'Keşfetmek']) expect(en).not.toContain(tr);
  });

  test('the buttons use the existing routes: sign-up, the AI section, and the scroll cue goes to About', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('link', { name: 'Calculate Your Carbon Footprint' })).toHaveAttribute('href', '/register');
    await expect(page.getByRole('link', { name: 'See How It Works' })).toHaveAttribute('href', '#ai');
    await expect(page.getByTestId('hero-scroll')).toHaveAttribute('href', '#about');
    await page.getByRole('link', { name: 'See How It Works' }).click();
    await expect(page).toHaveURL(/#ai$/);
    await expect.poll(() => page.evaluate(() => document.getElementById('ai').getBoundingClientRect().top), { timeout: 8000 }).toBeLessThan(400);
    await page.goto('/');
    await page.getByRole('link', { name: 'Calculate Your Carbon Footprint' }).click();
    await expect(page).toHaveURL(/\/register/, { timeout: 30_000 });   // (the first visit compiles the route in dev)
  });
});

test.describe('the Scope cards', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(async ({ page }) => { await reduceMotion(page); });

  test('three glass cards with real English text', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('hero-scopes').getByRole('listitem')).toHaveCount(3);
    await expect(page.getByTestId('hero-scope-s1')).toHaveText(/Scope 1\s*Direct Emissions from Operations/);
    await expect(page.getByTestId('hero-scope-s2')).toHaveText(/Scope 2\s*Indirect Emissions from Purchased Energy/);
    await expect(page.getByTestId('hero-scope-s3')).toHaveText(/Scope 3\s*Value Chain Emissions/);
    for (const k of ['s1', 's2', 's3']) {
      await expect(page.getByTestId(`hero-scope-${k}`).locator('svg')).toHaveCount(1);   // one green icon each
      const bg = await page.getByTestId(`hero-scope-${k}`).locator('.hero-card').evaluate(el => getComputedStyle(el).backgroundImage);
      expect(bg).toContain('rgba(255, 255, 255');
    }
  });

  test('...and Turkish', async ({ page }) => {
    await open(page, { lang: 'tr' });
    await expect(page.getByTestId('hero-scope-s1')).toHaveText(/Kapsam 1\s*Operasyonlardan Doğrudan Emisyonlar/);
    await expect(page.getByTestId('hero-scope-s2')).toHaveText(/Kapsam 2\s*Satın Alınan Enerjiden Dolaylı Emisyonlar/);
    await expect(page.getByTestId('hero-scope-s3')).toHaveText(/Kapsam 3\s*Değer Zinciri Emisyonları/);
  });

  test('on desktop they stand around the globe: Scope 1 and 3 on the left, Scope 2 on the right, clear of it and of each other', async ({ page }) => {
    await open(page);
    const g = await geometry(page);
    expect(g.cards.s1.r).toBeLessThan(g.globe.x - g.globe.r);
    expect(g.cards.s3.r).toBeLessThan(g.globe.x - g.globe.r);
    expect(g.cards.s2.x).toBeGreaterThan(g.globe.x + g.globe.r);
    expect(g.cards.s1.y).toBeLessThan(g.cards.s3.y);
    for (const c of Object.values(g.cards)) expect(clearance(g.globe, c)).toBeGreaterThan(24);
    expect(overlaps(g.cards.s1, g.cards.s3, 8)).toBe(false);
    // the connector lines run from each card to a node on the ring
    await expect(page.getByTestId('hero-links').locator('.hero-link')).toHaveCount(3);
  });
});

test.describe('orbital rings', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('three rings and a tick scale are drawn in SVG, with glowing nodes', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    await expect(page.getByTestId('hero-orbits')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByTestId('hero-ring')).toHaveCount(3);
    await expect(page.getByTestId('hero-ticks')).toHaveCount(1);
    expect(await page.getByTestId('hero-orbits').locator('.hero-node').count()).toBe(5);     // travelling nodes
    expect(await page.getByTestId('hero-orbits').locator('.hero-anchor').count()).toBe(3);   // one per card
    const g = await geometry(page);
    for (const sel of ['[data-testid="hero-ring"] .hero-ring-line', '[data-testid="hero-ticks"] circle']) {
      const boxes = await page.locator(sel).evaluateAll(els => els.map(e => { const b = e.getBoundingClientRect(); return [b.width, b.height, getComputedStyle(e).stroke]; }));
      for (const [w, h, stroke] of boxes) { expect(w).toBeGreaterThan(g.globe.r * 2); expect(h).toBeGreaterThan(g.globe.r * 2); expect(stroke).not.toBe('none'); }
    }
    // the rings enclose the globe's visible art (no ring cuts across the Earth)
    const [innermost] = (await page.locator('[data-testid="hero-ticks"] circle').first().evaluate(e => { const b = e.getBoundingClientRect(); return [b.width / 2]; }));
    expect(innermost).toBeGreaterThan(g.globe.r);
    // no raster ring art: the rings are not images
    expect(await page.locator('.hero-root img').count()).toBe(1);
    await expect(page.getByTestId('hero-orbits')).toHaveCSS('pointer-events', 'none');
  });

  test('they turn smoothly and independently while the Earth stays still', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    const anims = await heroAnims(page);
    const spins = anims.filter(a => a.name === 'hero-spin');
    expect(spins).toHaveLength(4);                                              // 3 rings + the tick scale
    for (const a of spins) { expect(a.infinite).toBe(true); expect(a.state).toBe('running'); }
    // different laps (independent), not one shared rotation
    const durations = await page.evaluate(() => document.getAnimations().filter(a => a.animationName === 'hero-spin').map(a => a.effect.getComputedTiming().duration));
    expect(new Set(durations).size).toBe(4);
    for (const d of durations) expect(d).toBeGreaterThanOrEqual(60_000);       // slow: at least a minute a lap
    // a node really travels
    const node = () => page.evaluate(() => { const b = document.querySelector('.hero-ring-a .hero-node-core').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
    const [x1, y1] = await node();
    await page.waitForTimeout(2500);
    const [x2, y2] = await node();
    expect(Math.hypot(x2 - x1, y2 - y1)).toBeGreaterThan(1.5);
    // smooth: linear easing
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.hero-ring-a')).animationTimingFunction)).toBe('linear');
    // the ring stays centred on the globe as it turns
    const g = await geometry(page);
    const c = await page.evaluate(() => { const b = document.querySelector('.hero-ring-c .hero-ring-line').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
    expect(Math.abs(c[0] - g.globe.x)).toBeLessThan(3);
    expect(Math.abs(c[1] - g.globe.y)).toBeLessThan(g.globe.r * 0.04);
  });

  test('cards float only a few pixels; clouds and leaves drift gently', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    const anims = await heroAnims(page);
    expect(anims.filter(a => a.name === 'hero-float')).toHaveLength(3);
    expect(anims.filter(a => a.name === 'hero-leaf').length).toBeGreaterThanOrEqual(3);
    expect(anims.filter(a => a.name === 'hero-drift').length).toBeGreaterThanOrEqual(3);
    const travel = await page.evaluate(() => {
      const kf = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).find(r => r.name === 'hero-float');
      return kf.cssText;
    });
    expect(travel).toMatch(/translateY\(-5px\)/);
  });

  test('reduced motion: the finished picture, no animation of any kind', async ({ page }) => {
    await reduceMotion(page);
    await open(page);
    await expectReduced(page);
    expect(await heroAnims(page)).toEqual([]);
    // the rings and cards are still drawn
    await expect(page.getByTestId('hero-ring')).toHaveCount(3);
    expect(await page.getByTestId('hero-scopes').locator('.hero-card').count()).toBe(3);
    expect(await page.locator('.hero-card').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  });

  test('everything pauses when the hero is scrolled away or the tab is hidden, and resumes', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await open(page);
    await expect(page.locator('.hero-root')).toHaveAttribute('data-hero-motion', 'on');
    expect((await heroAnims(page)).every(a => a.state === 'running')).toBe(true);

    await page.evaluate(() => window.scrollTo(0, 2200));
    await expect(page.locator('.hero-root')).toHaveAttribute('data-hero-motion', 'paused');
    const paused = await heroAnims(page);
    expect(paused.length).toBeGreaterThan(8);
    expect(paused.every(a => a.state === 'paused')).toBe(true);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('.hero-root')).toHaveAttribute('data-hero-motion', 'on');
    expect((await heroAnims(page)).every(a => a.state === 'running')).toBe(true);

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('.hero-root')).toHaveAttribute('data-hero-motion', 'paused');
    expect((await heroAnims(page)).every(a => a.state === 'paused')).toBe(true);
  });
});

test.describe('layout shift', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('nothing moves while the Earth loads: same boxes before and after, and a negligible CLS', async ({ page }) => {
    await reduceMotion(page);
    // hold the Earth back so the "before" state is really before the picture
    await page.route(/globalnew-hero\.webp/, async route => { await new Promise(r => setTimeout(r, 1200)); await route.continue(); });
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.addInitScript(() => { localStorage.setItem('language', 'en'); localStorage.setItem('language_explicit', '1'); });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('hero-h1')).toBeVisible();
    const pick = () => page.evaluate(() => ['.hero-h1', '[data-testid="hero-stage"]', '[data-testid="hero-scopes"]', '.hero-ctas', '.hero-root'].map(s => {
      const b = document.querySelector(s).getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(v => Math.round(v * 2) / 2);
    }));
    await page.evaluate(() => document.fonts.ready);                 // the headline font (a CDN font) may swap in under load; this test is about the picture
    const before = await pick();
    const loaded = await page.evaluate(() => document.querySelector('[data-testid="hero-earth"] img').complete);
    expect(loaded).toBe(false);                                      // the picture truly had not arrived
    await expect.poll(() => page.evaluate(() => document.querySelector('[data-testid="hero-earth"] img').complete), { timeout: 10_000 }).toBe(true);
    await page.waitForTimeout(400);
    expect(await pick()).toEqual(before);
    expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.02);
  });
});

test.describe('responsive', () => {
  test.beforeEach(async ({ page }) => { await reduceMotion(page); });
  const sizes = [
    { width: 360, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 },
    { width: 768, height: 1024 }, { width: 820, height: 1180 },
    { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1366, height: 768 },
    { width: 1440, height: 900 }, { width: 1600, height: 900 }, { width: 1920, height: 1080 },
  ];
  for (const lang of ['en', 'tr']) {
    for (const s of sizes) {
      test(`${lang} ${s.width}x${s.height}: centred, no overflow, nothing clipped or colliding`, async ({ page }) => {
        await page.setViewportSize({ width: s.width, height: s.height });
        await open(page, { lang });
        await expectReduced(page);
        const g = await geometry(page);
        const wide = s.width >= 1024;

        // no horizontal scroll; the whole globe and every ring are inside the window
        expect(g.overflowX).toBeLessThanOrEqual(0);
        expect(g.globe.x - g.globe.r).toBeGreaterThanOrEqual(0);
        expect(g.globe.x + g.globe.r).toBeLessThanOrEqual(g.viewW);
        // centred composition: the globe is on the window's middle line, the copy is centred under it
        const mid = g.root.w / 2;
        expect(Math.abs(g.globe.x - mid)).toBeLessThan(g.root.w * 0.006);
        for (const line of g.lines) { expect(Math.abs((line.x + line.r) / 2 - mid)).toBeLessThan(g.root.w * 0.01); expect(line.x).toBeGreaterThanOrEqual(0); expect(line.r).toBeLessThanOrEqual(g.viewW); }
        expect(Math.abs((g.eyebrow.x + g.eyebrow.r) / 2 - mid)).toBeLessThan(g.root.w * 0.01);
        expect(g.eyebrow.x).toBeGreaterThanOrEqual(0); expect(g.eyebrow.r).toBeLessThanOrEqual(g.viewW);
        // the globe is the focus: up in the hero, above the headline; the headline is below the globe's visible art
        expect(g.globe.y).toBeLessThan(g.lines[0].y);
        expect(g.lines[0].y).toBeGreaterThan(g.globe.y + g.globe.r - 4);
        // the globe's size follows the screen
        expect(wide ? g.globe.r * 2 : g.globe.r * 2 / g.viewW).toBeGreaterThan(wide ? 220 : 0.4);
        expect(g.globe.r * 2 / g.viewW).toBeLessThan(wide ? 0.42 : 0.82);

        // the cards: inside the window, not clipped, not over each other, not over the globe or the copy
        const cards = Object.values(g.cards);
        for (const c of cards) { expect(c.x).toBeGreaterThanOrEqual(2); expect(c.r).toBeLessThanOrEqual(g.viewW - 2); }
        expect(overlaps(g.cards.s1, g.cards.s2, 4)).toBe(false); expect(overlaps(g.cards.s2, g.cards.s3, 4)).toBe(false); expect(overlaps(g.cards.s1, g.cards.s3, 4)).toBe(false);
        for (const c of cards) expect(clearance(g.globe, c)).toBeGreaterThan(wide ? 24 : 8);
        const copy = [...g.lines, g.desc, g.eyebrow, ...g.ctas];
        for (const c of cards) for (const box of copy) expect(overlaps(c, box, 4)).toBe(false);
        // the copy clears the globe's visible circle
        for (const box of copy) expect(clearance(g.globe, box)).toBeGreaterThan(4);
        // readable text, and no card text is clipped
        const text = await page.evaluate(() => ({
          title: [...document.querySelectorAll('.hero-card-title')].map(e => parseFloat(getComputedStyle(e).fontSize)),
          sub: [...document.querySelectorAll('.hero-card-sub')].map(e => parseFloat(getComputedStyle(e).fontSize)),
          clipped: [...document.querySelectorAll('.hero-card, .hero-card-text, .hero-card-title, .hero-card-sub, .hero-cta, .hero-cta-secondary, .hero-eyebrow, .hero-line')]
            .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className),
        }));
        for (const f of text.title) expect(f).toBeGreaterThanOrEqual(13);
        for (const f of text.sub) expect(f).toBeGreaterThanOrEqual(11);
        expect(text.clipped).toEqual([]);

        // buttons: inside the window, comfortable to tap
        for (const b of g.ctas) { expect(b.x).toBeGreaterThanOrEqual(0); expect(b.r).toBeLessThanOrEqual(g.viewW); expect(b.h).toBeGreaterThanOrEqual(44); }
        // the primary button is the wider one and is first
        expect(g.ctas[0].w).toBeGreaterThan(g.ctas[1].w);
        // the stacked layout: cards come after the globe and before the headline; the wide layout: beside it
        if (wide) {
          expect(g.cards.s1.x).toBeLessThan(g.globe.x - g.globe.r); expect(g.cards.s2.x).toBeGreaterThan(g.globe.x + g.globe.r);
          expect(g.scroll.y).toBeGreaterThan(g.ctas[0].b);                       // the scroll cue sits under the buttons
          expect(g.scroll.b).toBeLessThanOrEqual(g.root.b + 1);
          // a sane height: about one screen (the cue is the last thing)
          expect(g.root.b).toBeLessThanOrEqual(s.height + 60);
          // wide cards are clear of the rings too (outer ring is 308 of the stage's 640 units tall)
          const ringR = g.stage.h * (308 / 640);
          for (const c of cards) expect(clearance(g.globe, c, ringR)).toBeGreaterThan(-2);
        } else {
          expect(g.cards.s1.y).toBeGreaterThan(g.stage.b - 12);
          expect(g.lines[0].y).toBeGreaterThan(Math.max(...cards.map(c => c.b)));
          if (s.width < 600) { expect(g.cards.s2.y).toBeGreaterThan(g.cards.s1.b - 1); expect(g.cards.s3.y).toBeGreaterThan(g.cards.s2.b - 1); }
          else { expect(Math.abs(g.cards.s1.y - g.cards.s2.y)).toBeLessThan(4); expect(g.cards.s2.x).toBeGreaterThan(g.cards.s1.r); }
          // a reasonable height on phones: under 1.5 screens
          if (s.width < 768) expect(g.root.b).toBeLessThan(s.height * 1.5);
        }
      });
    }
  }
});

test.describe('the enlarged Earth fits every size, phones included', () => {
  const sizes = [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1600, height: 900 }, { width: 1920, height: 1080 }];
  for (const s of sizes) {
    test(`${s.width}x${s.height}: ~12% larger, inside the window and the stage, clear of the Header and the cards, no overflow`, async ({ page }) => {
      await page.setViewportSize(s);
      await reduceMotion(page);
      await open(page);
      const w0 = (await geometry(page)).img.w;
      await openEarth(page);
      const g = await geometry(page);
      expect(g.img.w / w0).toBeGreaterThanOrEqual(1.10); expect(g.img.w / w0).toBeLessThanOrEqual(1.15);
      expect(Math.abs(g.img.w / g.img.h - ART.w / ART.h)).toBeLessThan(0.005);
      expect(g.img.x).toBeGreaterThanOrEqual(0); expect(g.img.r).toBeLessThanOrEqual(g.viewW);
      expect(g.img.y).toBeGreaterThanOrEqual(g.stage.y - 1); expect(g.img.b).toBeLessThanOrEqual(g.stage.b + 1);
      const header = await page.locator('header').first().boundingBox();
      expect(g.img.y).toBeGreaterThanOrEqual(header.y + header.height);
      for (const c of Object.values(g.cards)) expect(overlaps(g.img, c)).toBe(false);
      expect(g.overflowX).toBeLessThanOrEqual(0);
    });
  }
});
