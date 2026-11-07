/**
 * Smoke test — responsive behaviour across the application.
 *
 * Locks in what the full responsive audit found and fixed (the audit itself measured every public route at 13 viewports in both
 * languages, every dashboard tab, and the questionnaire flow; this spec keeps the important guarantees from regressing):
 *  - no horizontal page overflow and nothing outside the window (unless inside its own clipping / scrolling box) on every public
 *    and authentication route at the 13 required viewport sizes (320 to 2560 px), and on every dashboard tab at five sizes
 *  - the Header's pill always holds its controls (320-768 px), with 44 px-high tap targets from 360 px
 *  - the password field and its show/hide button stay inside their card at 320 px (reset-password)
 *  - footer links are 44 px-high tap targets on phones and tablets
 *  - dialogs that are taller than a short screen (a phone in landscape) scroll instead of being cut off
 *  - the questionnaire's answer options are tap-sized and nothing overflows at 320 and 360 px
 *  - a long e-mail address wraps inside its Settings card; the empty-state banner keeps a readable width on a phone
 * Interactive controls on touch screens: 44 px (WCAG 2.5.5); the compact desktop shell is unchanged on desktop.
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

const VIEWPORTS = [[320, 568], [360, 800], [375, 812], [390, 844], [430, 932], [600, 960], [768, 1024], [1024, 768], [1280, 720], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440]];
const PUBLIC = ['/', '/about', '/ai', '/features', '/contact', '/privacy', '/terms', '/login', '/register', '/forgot-password', '/reset-password?token=x', '/verify-email?email=a@b.co', '/join', '/accept-invite?token=x'];
const TABS = ['dashboard', 'questionnaire', 'emissions', 'review', 'reduction', 'reporting', 'settings', 'benchmark', 'how_it_works', 'ai_carbon'];

/** horizontal overflow + elements outside the window that are not inside a clipping / scrolling box (runs in the page) */
const scan = () => {
  const W = document.documentElement.getBoundingClientRect().width;
  const off = [];
  for (const e of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || (r.right <= W + 1.5 && r.left >= -1.5)) continue;
    let clipped = false;
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      if (getComputedStyle(a).overflowX !== 'visible') { const ar = a.getBoundingClientRect(); if (ar.left >= -1.5 && ar.right <= W + 1.5) { clipped = true; break; } }
    }
    if (!clipped) off.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)} ${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  return { overflow: Math.round(document.documentElement.scrollWidth - W), off: off.slice(0, 5) };
};

const lang = (page, l) => page.addInitScript(x => { localStorage.setItem('language', x); localStorage.setItem('language_explicit', '1'); }, l);

test.describe('public and authentication routes: every required viewport', () => {
  test.setTimeout(240_000);
  for (const route of PUBLIC) {
    test(`${route}: no overflow and nothing outside the window, 320 to 2560 px`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      for (const [w, h] of VIEWPORTS) {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(route);
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(250);
        const r = await page.evaluate(scan);
        expect(r.overflow, `${route} @${w}: horizontal overflow`).toBeLessThanOrEqual(1);
        expect(r.off, `${route} @${w}: outside the window`).toEqual([]);
      }
      expect(errors).toEqual([]);
    });
  }

  test('Turkish: the home, About and AI pages at phone and tablet sizes', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await lang(page, 'tr');
    for (const route of ['/', '/about', '/ai', '/features', '/contact']) for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [1366, 768]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(route);
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
      const r = await page.evaluate(scan);
      expect(r.overflow, `${route} tr @${w}`).toBeLessThanOrEqual(1);
      expect(r.off, `${route} tr @${w}`).toEqual([]);
    }
  });
});

test.describe('the Header', () => {
  test.use({ isMobile: true, hasTouch: true });   // a phone has overlay scrollbars; desktop Chromium reserves a 15 px gutter (html { scrollbar-gutter: stable }) that no phone has
  for (const w of [320, 340, 360, 375, 390, 414, 430, 600, 768]) {
    test(`${w} px: the pill holds its controls; tap targets are 44 px high from 360 px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 800 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      const m = await page.evaluate(() => {
        const nav = document.querySelector('header nav').getBoundingClientRect();
        const box = el => { const r = el.getBoundingClientRect(); return { r: r.right, h: r.height, w: r.width }; };
        return { nav: nav.right, cta: box(document.querySelector('header nav a[href="/register"]')), burger: box(document.querySelector('header nav button[aria-label="Open menu"]')), lang: box(document.querySelector('header nav button[aria-label*="Türkçe"], header nav button[aria-label*="English"]')), logo: box(document.querySelector('header nav a[href="/"]')) };
      });
      expect(m.nav - m.cta.r).toBeGreaterThanOrEqual(4);                                  // the Create Account button never touches the pill's edge
      if (w >= 360) for (const k of (w < 768 ? ['cta', 'burger', 'lang', 'logo'] : ['cta', 'lang', 'logo'])) expect(m[k].h, k).toBeGreaterThanOrEqual(43.5);   // (the menu button exists below 768 px only)
      if (w >= 430) expect(m.lang.w).toBeGreaterThanOrEqual(43.5);
      if (w >= 430 && w < 768) expect(m.burger.w).toBeGreaterThanOrEqual(43.5);
    });
  }

  test('phone: the menu opens inside the window, lists every link and closes', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const links = page.locator('header nav a:visible');
    await expect(page.getByRole('link', { name: 'About', exact: true }).last()).toBeVisible();
    const b = await page.locator('header nav > div').last().boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(320);
    expect(await links.count()).toBeGreaterThanOrEqual(6);
    for (const box of await page.locator('header nav a:visible').evaluateAll(els => els.filter(e => e.closest('nav > div:last-child')).map(e => e.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(43);
    await page.getByRole('button', { name: 'Close menu' }).click();
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
  });
});

test.describe('authentication pages', () => {
  test('reset-password at 320 px: the password fields and the show/hide buttons stay inside the card', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/reset-password?token=x');
    const card = await page.locator('form').boundingBox();
    const eye = page.getByRole('button', { name: /show password/i });
    await expect(eye).toBeVisible();
    const e = await eye.boundingBox();
    expect(e.x).toBeGreaterThanOrEqual(card.x); expect(e.x + e.width).toBeLessThanOrEqual(card.x + card.width + 1);
    expect(e.width).toBeGreaterThanOrEqual(40); expect(e.height).toBeGreaterThanOrEqual(40);       // a comfortable hit area (the icon itself is 16 px)
    await eye.click();
    await expect(page.locator('form input[type="text"]').first()).toBeVisible();
  });

  for (const [w, h] of [[320, 568], [390, 844], [768, 1024]]) {
    test(`login at ${w} px: language switch, logo, fields and show/hide button are tap-sized and inside the window`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/login');
      for (const sel of ['button:has-text("EN")', 'button:has-text("TR")', 'a[href="/forgot-password"]']) {
        const b = await page.locator(sel).first().boundingBox();
        expect(b.height, sel).toBeGreaterThanOrEqual(43.5);
        expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(w + 1);
      }
      const eye = await page.getByRole('button', { name: /show password/i }).boundingBox();
      expect(eye.width).toBeGreaterThanOrEqual(40); expect(eye.height).toBeGreaterThanOrEqual(40);
    });
  }
});

test.describe('the Footer', () => {
  for (const [w, h] of [[390, 844], [768, 1024]]) {
    test(`${w} px: every footer link row is a 44 px tap target`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/about');
      const rows = await page.locator('footer ul a').evaluateAll(els => els.map(e => ({ t: e.textContent.trim(), h: e.getBoundingClientRect().height })));
      expect(rows.length).toBeGreaterThanOrEqual(10);
      for (const r of rows) expect(r.h, r.t).toBeGreaterThanOrEqual(43.5);
    });
  }
  test('desktop: the footer keeps its compact link spacing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/about');
    const hs = await page.locator('footer ul a').evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
    for (const h of hs) expect(h).toBeLessThan(30);
  });
});

test.describe('the application (authenticated, mocked backend)', () => {
  test.beforeEach(async ({ page }) => { await mockDjangoApi(page); await seedAuth(page); await page.emulateMedia({ reducedMotion: 'reduce' }); });
  test.setTimeout(240_000);

  for (const tab of TABS) {
    test(`dashboard tab "${tab}": no overflow at 320, 390, 768, 1024 and 1440 px`, async ({ page }) => {
      for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1440, 900]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(`/dashboard?tab=${tab}`);
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(400);
        const r = await page.evaluate(scan);
        expect(r.overflow, `${tab} @${w}`).toBeLessThanOrEqual(1);
        expect(r.off, `${tab} @${w}`).toEqual([]);
      }
    });
  }

  test('the dashboard overview empty-state banner keeps a readable text width on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/dashboard');
    const banner = page.getByRole('status').filter({ hasText: /Log your first entry/ });
    await expect(banner).toBeVisible();
    const t = await banner.locator('span').first().boundingBox();
    expect(t.width).toBeGreaterThan(200);                                            // it was 35 px: one word per line
  });

  test('Settings: a long e-mail address wraps inside its card at tablet width', async ({ page }) => {
    await page.route('http://localhost:8000/api/accounts/profile/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'u', email: 'a.very.long.address.for.testing.the.layout@a-rather-long-company-domain-name.example.com', first_name: 'A', is_staff: false }) }));
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/dashboard?tab=settings');
    const card = page.locator('p.font-bold.text-xs', { hasText: 'a.very.long.address' }).first();
    await expect(card).toBeVisible();
    const m = await card.evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth, parent: el.parentElement.getBoundingClientRect().right, own: el.getBoundingClientRect().right }));
    expect(m.sw).toBeLessThanOrEqual(m.cw + 1);
    expect(m.own).toBeLessThanOrEqual(m.parent + 1);
  });

  test('touch sizing: the compact app controls become 44 px under 1024 px and stay compact on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    const phone = await page.evaluate(() => ({ nav: getComputedStyle(document.documentElement).getPropertyValue('--app-nav-item-h').trim(), ctl: getComputedStyle(document.documentElement).getPropertyValue('--app-control-h').trim() }));
    expect(phone).toEqual({ nav: '2.75rem', ctl: '2.75rem' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard');
    const desktop = await page.evaluate(() => ({ nav: getComputedStyle(document.documentElement).getPropertyValue('--app-nav-item-h').trim(), ctl: getComputedStyle(document.documentElement).getPropertyValue('--app-control-h').trim() }));
    expect(desktop).toEqual({ nav: '2rem', ctl: '2.25rem' });
  });

  test('a dialog taller than a very short screen scrolls: its buttons stay reachable', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 220 });
    await page.goto('/dashboard?tab=settings&section=data');
    const trigger = page.getByRole('button', { name: /Permanently Delete Account/ });
    await trigger.evaluate(el => el.click());                                         // (on a 220 px-high screen the app's fixed bottom bar can cover it)
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const overlay = page.locator('div.fixed.inset-0.overflow-y-auto').filter({ has: dialog });
    const o = await overlay.evaluate(el => ({ scrollable: el.scrollHeight > el.clientHeight, top: el.scrollTop }));
    expect(o.scrollable).toBe(true);                                                  // taller than the screen: the overlay scrolls
    const del = dialog.getByRole('button', { name: 'Delete', exact: true });
    await del.scrollIntoViewIfNeeded();
    const b = await del.boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0); expect(b.y + b.height).toBeLessThanOrEqual(220);   // the button can be brought on screen
    await overlay.evaluate(el => { el.scrollTop = 0; });
    const h2 = await dialog.getByRole('heading', { name: 'Delete Account' }).boundingBox();
    expect(h2.y).toBeGreaterThanOrEqual(0);                                           // and the top of the dialog can be too (it is not cut off)
  });
});

test.describe('the questionnaire on small phones', () => {
  const PHASE1 = { A1: { answer: 'Alpha' }, A2: { answer: 'x' }, A3: { answer: 'x' }, A4: { answer: '2025' }, A5: { answer: 'x' }, A6: { answer: 'x' }, A7: { answer: 'no' }, B1: { answer: 'NACE_A' }, B2: { answer: 'Makes things' } };
  const report = { report_id: 1, title: 'Inventory A', status: 'in_progress', reporting_year: 2025, current_step: 'B5', progress: { percent: 10, completed: 9, total: 98 }, updated_at: '2026-01-01T00:00:00Z', created_by: null };

  test.beforeEach(async ({ page }) => {
    await mockDjangoApi(page);
    await seedAuth(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('http://localhost:8000/api/**', async (route) => {
      const url = new URL(route.request().url());
      const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/api/questionnaire/') return json({ reports: [report] });
      if (/^\/api\/questionnaire\/1\/$/.test(url.pathname)) return json({ ...report, answers: PHASE1, completed_steps: Object.keys(PHASE1), advisor_rejected: [], advisor_pending: 0, pending_questions: [] });
      return route.fallback();
    });
  });

  test('320x568: a short inventory list scrolls clear of the bottom bar, and the answer panel has real room', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/dashboard?tab=questionnaire');
    await page.getByRole('button', { name: /Continue/ }).first().click();          // it used to stay under the bottom navigation
    await expect(page.getByTestId('pinned-question')).toBeVisible();
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="input-panel"]').getBoundingClientRect();
      return { h: p.height, pin: getComputedStyle(document.querySelector('[data-testid="pinned-question"]')).position, launcher: getComputedStyle(document.querySelector('[data-testid="ai-launcher"]')).display };
    });
    expect(m.h).toBeGreaterThan(230);                                               // it was ~180 px, most of it under the sticky question
    expect(m.pin).toBe('static');                                                   // on a short screen the question scrolls with the form
    expect(m.launcher).toBe('none');                                                // "Ask AI Help" is in the card: no floating button over it
  });

  test('568x320 (phone in landscape): no bottom bar, the menu button stays, and the answers get the room', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 320 });
    await page.goto('/dashboard?tab=questionnaire');
    await page.getByRole('button', { name: /Continue/ }).first().click();
    await expect(page.getByTestId('pinned-question')).toBeVisible();
    await page.waitForTimeout(800);
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden();
    await expect(page.locator('header button').first()).toBeVisible();              // navigation stays one tap away in the drawer
    const h = await page.getByTestId('input-panel').evaluate(el => el.getBoundingClientRect().height);
    expect(h).toBeGreaterThan(100);                                                 // it was ~44 px
    const r = await page.evaluate(scan);
    expect(r.overflow).toBeLessThanOrEqual(1);
  });

  test('taller phones keep the pinned question and the bottom bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard?tab=questionnaire');
    await page.getByRole('button', { name: /Continue/ }).first().click();
    await expect(page.getByTestId('pinned-question')).toBeVisible();
    expect(await page.getByTestId('pinned-question').evaluate(el => getComputedStyle(el).position)).toBe('sticky');
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  });

  for (const [w, h] of [[320, 568], [360, 800]]) {
    for (const l of ['en', 'tr']) {
      test(`${l} ${w} px: the question card, its options and its buttons fit and are tap-sized`, async ({ page }) => {
        await lang(page, l);
        await page.setViewportSize({ width: w, height: h });
        await page.goto('/dashboard?tab=questionnaire');
        await page.getByRole('button', { name: l === 'tr' ? /Devam/ : /Continue/ }).first().click();
        const card = page.getByTestId('pinned-question');
        await expect(card).toBeVisible();
        const r = await page.evaluate(scan);
        expect(r.overflow).toBeLessThanOrEqual(1);
        expect(r.off).toEqual([]);
        // every answer option is at least 44 px high and inside the window
        const opts = await page.getByTestId('input-panel').locator('button').filter({ hasNotText: /Ask AI|Yardım|Confirm|Onayla|later|sonra|skip/i }).evaluateAll(els => els.filter(e => e.getBoundingClientRect().width > 60).map(e => { const b = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 20), h: b.height, x: b.left, r: b.right }; }));
        expect(opts.length).toBeGreaterThanOrEqual(5);
        for (const o of opts) { expect(o.h, o.t).toBeGreaterThanOrEqual(43.5); expect(o.x).toBeGreaterThanOrEqual(0); expect(o.r).toBeLessThanOrEqual(w + 1); }
        // answer later / AI help are reachable inside the screen
        for (const btn of [page.getByTestId('answer-later-button')]) {
          await btn.scrollIntoViewIfNeeded();
          const b = await btn.boundingBox();
          expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(w + 1);
        }
      });
    }
  }
});
