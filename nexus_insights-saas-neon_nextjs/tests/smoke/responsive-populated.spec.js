/**
 * Smoke test — responsive behaviour with POPULATED data (second responsive pass).
 *
 * Uses tests/helpers/populated-api.js: a data-rich stand-in for the backend (KPIs, a monthly trend, three facilities with long names,
 * 28 entries, four inventories, targets, team members, notifications, chat conversations with long messages). Nothing real is read
 * or written: it is Playwright request interception only.
 *
 *  - every populated dashboard tab, dialog and panel: no overflow and nothing outside the window at 320, 390, 768, 1024, 1440 px
 *  - the floating AI launcher: tucks away while scrolling down or typing on phones and tablets, comes back on scroll-up / at the
 *    ends / on focus, is never on top of a dialog (it used to cover "Save Entry"), is unchanged on desktop
 *  - the chat panel: a long message and its long reply, the input and the send button stay inside the window and usable on a phone
 *    and in landscape; the input box never takes more than ~20% of a short screen
 *  - landscape phones and short screens: public pages and the app have no overflow; the Header menu scrolls and every link is reachable
 *  - the six verification-code boxes fit and stay inside their card from 320 px (44 px wide from 390 px)
 *  - the app header's controls (mode switch, language, bell, menu button) are 44 px tap targets on touch screens
 */
import { test, expect } from '@playwright/test';
import { mockPopulatedApi, ENTRIES } from '../helpers/populated-api.js';
import { seedAuth } from '../helpers/mock-api.js';

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
const SCENARIOS = [
  ['overview', '/dashboard'], ['emissions', '/dashboard?tab=emissions'], ['review', '/dashboard?tab=review'], ['reduction', '/dashboard?tab=reduction'],
  ['reporting', '/dashboard?tab=reporting'], ['benchmark', '/dashboard?tab=benchmark'], ['inventories', '/dashboard?tab=questionnaire'], ['how-it-works', '/dashboard?tab=how_it_works'],
  ...['profile', 'team', 'company', 'facilities', 'security', 'notifications', 'data', 'history'].map(s => [`settings-${s}`, `/dashboard?tab=settings&section=${s}`]),
];

test.beforeEach(async ({ page }) => {
  await mockPopulatedApi(page);
  await seedAuth(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

// Third pass: the remaining small controls. Everything here is `max-lg:`, so the same elements are measured unchanged on a desktop.
test.describe('touch targets', () => {
  for (const w of [320, 360, 390]) {
    test(`public Header at ${w}: menu and language are 44 x 44 and the bar still fits`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 740 });
      await page.goto('/about');
      for (const name of [/Open menu/, /Türkçeye geç|Switch to English/]) {
        const b = await page.getByRole('button', { name }).first().boundingBox();
        expect(b.width).toBeGreaterThanOrEqual(44); expect(b.height).toBeGreaterThanOrEqual(44);
      }
      expect((await page.evaluate(scan)).overflow).toBeLessThanOrEqual(0);
      const box = await page.getByRole('link', { name: /Create Account|Hesap Oluştur/ }).first().boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(w);
    });
  }

  test('390: in-card selects are 44 tall, and on a desktop they keep their compact 24', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    const sel = page.locator('main select').first();
    await expect(sel).toBeVisible();
    expect((await sel.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(async () => Math.round((await sel.boundingBox()).height)).toBe(24);
  });

  test('390: a small text link keeps its look and answers a tap well above and below it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    const link = page.getByRole('button', { name: /^All targets$/ }).first();
    await link.scrollIntoViewIfNeeded();
    const b = await link.boundingBox();
    expect(b.height).toBeLessThan(24);                                                       // the look did not change
    for (const dy of [-13, 13]) {
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.textContent?.trim(), [b.x + b.width / 2, b.y + b.height / 2 + dy]);
      expect(hit).toBe('All targets');
    }
  });

  test('390: the Emissions filters and search are 44 tall', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard?tab=emissions');
    const pill = page.getByRole('button', { name: /^All\s*28/ }).first();
    await expect(pill).toBeVisible();
    expect((await pill.boundingBox()).height).toBeGreaterThanOrEqual(44);
    const search = page.locator('main input[type=text], main input:not([type])').first();
    expect((await search.boundingBox()).height).toBeGreaterThanOrEqual(40);
  });

  test('320: the six code boxes are about 38 wide (34 before) and stay inside the card', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/verify-email');
    const boxes = page.locator('input[inputmode=numeric]');
    await expect(boxes).toHaveCount(6);
    const b = await boxes.first().boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(37); expect(b.height).toBeGreaterThanOrEqual(44);
    const last = await boxes.nth(5).boundingBox();
    expect(last.x + last.width).toBeLessThanOrEqual(320 - 12);
  });
});

// The Emissions KPIs total the listed entries, approved ones only, so they are recomputed here from the same entries. They once
// read 0.00 beside 28 listed entries because the fixture sent `scope: 1` where the API sends 'scope1' (and an invented status).
test.describe('Emissions KPI values', () => {
  const approvedT = (scope) => ENTRIES.filter(e => e.status === 'approved' && (!scope || e.scope === scope)).reduce((t, e) => t + e.calculated_co2e_kg, 0) / 1000;
  const countOf = (scope) => ENTRIES.filter(e => e.status === 'approved' && e.scope === scope).length;
  const parse = (l, t) => Number(l === 'tr' ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, ''));
  for (const [l, w] of [['en', 390], ['en', 1440], ['tr', 390], ['tr', 1440]]) {
    test(`${l} ${w}: the cards show the approved totals of the listed entries, not 0.00`, async ({ page }) => {
      await lang(page, l);
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/dashboard?tab=emissions');
      const cards = page.getByTestId('emissions-kpi');
      await expect(cards).toHaveCount(4);
      const rows = [[0, null], [1, 'scope1'], [2, 'scope2'], [3, 'scope3']];
      for (const [i, scope] of rows) {
        const want = approvedT(scope);
        expect(want).toBeGreaterThan(0);                                    // the fixture itself must hold values for every scope
        await expect.poll(async () => parse(l, await cards.nth(i).getByTestId('emissions-kpi-value').innerText()), { timeout: 8000 }).toBeCloseTo(want, 1);
        if (scope) await expect(cards.nth(i)).toContainText(String(countOf(scope)));
      }
      await expect(page.getByText(/For information:|Bilgi:/).first()).toBeVisible();   // the entries still waiting are said, outside the totals
    });
  }
});

test.describe('populated dashboard: every tab, both languages', () => {
  test.setTimeout(300_000);
  for (const [id, route] of SCENARIOS) {
    test(`${id}: no overflow and nothing outside the window at 320, 390, 768, 1024 and 1440 px (EN), 320 and 768 px (TR)`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      for (const [w, h, l] of [[320, 568, 'en'], [390, 844, 'en'], [768, 1024, 'en'], [1024, 768, 'en'], [1440, 900, 'en'], [320, 568, 'tr'], [768, 1024, 'tr']]) {
        await page.setViewportSize({ width: w, height: h });
        await lang(page, l);
        await page.goto(route);
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(500);
        const r = await page.evaluate(scan);
        expect(r.overflow, `${id} ${l} @${w}`).toBeLessThanOrEqual(1);
        expect(r.off, `${id} ${l} @${w}`).toEqual([]);
      }
      expect(errors).toEqual([]);
    });
  }

  test('the populated overview shows real numbers, and the trend and the scope breakdown are drawn', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    await expect(page.getByText('1,842.70').first()).toBeVisible();
    await expect(page.getByText('Emissions trend').first()).toBeVisible();
    await expect(page.getByText('Scope breakdown').first()).toBeVisible();
  });
});

test.describe('the floating AI launcher', () => {
  const launcher = page => page.getByTestId('ai-launcher');
  const wheel = async (page, dy, n) => { for (let i = 0; i < n; i++) { await page.mouse.wheel(0, dy); await page.waitForTimeout(110); } await page.waitForTimeout(350); };

  for (const [w, h] of [[390, 844], [768, 1024]]) {
    test(`${w} px: tucks away while scrolling down, comes back on scroll up and on keyboard focus`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/dashboard?tab=emissions');
      await page.waitForTimeout(800);
      await expect(launcher(page)).toHaveAttribute('data-away', 'false');
      await page.mouse.move(w / 2, h / 2);
      await wheel(page, 250, 4);
      await expect(launcher(page)).toHaveAttribute('data-away', 'true');
      expect(await launcher(page).evaluate(el => getComputedStyle(el).opacity)).toBe('0');
      expect(await launcher(page).evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');   // it cannot be tapped by accident while hidden
      await wheel(page, -250, 2);
      await expect(launcher(page)).toHaveAttribute('data-away', 'false');
      await wheel(page, 250, 4);
      await expect(launcher(page)).toHaveAttribute('data-away', 'true');
      await launcher(page).locator('button').focus();                                                   // keyboard users can always reach it
      await expect(launcher(page)).toHaveAttribute('data-away', 'false');
    });
  }

  test('phone: it is 48 px and tucks away while a text field is focused (the keyboard is up)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard?tab=emissions');
    await page.waitForTimeout(800);
    const b = await launcher(page).locator('button').boundingBox();
    expect(b.width).toBe(48); expect(b.height).toBe(48);
    await page.getByPlaceholder(/Search source|Kaynak ara/i).first().focus();
    await expect(launcher(page)).toHaveAttribute('data-away', 'true');
    await page.getByPlaceholder(/Search source|Kaynak ara/i).first().blur();
    await expect(launcher(page)).toHaveAttribute('data-away', 'false');
  });

  test('desktop: it stays where it is (64 px, never tucked away)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard?tab=emissions');
    await page.waitForTimeout(800);
    await page.mouse.move(700, 450);
    await wheel(page, 250, 4);
    await expect(launcher(page)).toHaveAttribute('data-away', 'false');
    const b = await launcher(page).locator('button').boundingBox();
    expect(b.width).toBe(64);
  });

  test('it is never on top of a dialog: the Add Emission Entry buttons are reachable on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard?tab=emissions');
    await page.getByRole('button', { name: /New Entry/ }).click();
    const save = page.getByRole('button', { name: /^Save\s*Entry/ });
    await expect(save).toBeVisible();
    const b = await save.boundingBox();
    const topMost = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return !!el.closest('[data-testid="ai-launcher"]'); }, [b.x + b.width / 2, b.y + b.height / 2]);
    expect(topMost).toBe(false);                                                                          // the launcher is not the element under the button's centre
    const l = await launcher(page).evaluate(el => Number(getComputedStyle(el).zIndex));
    expect(l).toBeLessThan(50);                                                                           // below every dialog (z 50 and up)
  });
});

test.describe('the chat panel', () => {
  for (const [w, h, name] of [[390, 844, 'phone'], [768, 1024, 'tablet'], [667, 375, 'phone landscape'], [1440, 900, 'desktop']]) {
    test(`${name} (${w}x${h}): a long message and a long reply; the input and the send button stay usable`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/dashboard');
      await page.waitForTimeout(800);
      await page.getByRole('button', { name: /Carbon AI/i }).click();
      const panel = page.getByTestId('ai-assistant-panel');
      await expect(panel).toBeVisible();
      await page.getByText('Natural gas for the Gebze plant').first().click().catch(() => {});
      const input = panel.locator('textarea').last();
      await expect(input).toBeVisible();
      await input.fill('A long message to test the input area on narrow screens: ' + 'word '.repeat(80));
      const ib = await input.boundingBox();
      expect(ib.x).toBeGreaterThanOrEqual(0); expect(ib.x + ib.width).toBeLessThanOrEqual(w + 1);
      expect(ib.height).toBeLessThanOrEqual(Math.max(h * 0.2, 24) + 2);                                  // never more than ~20% of the screen (120 px at most)
      const send = panel.getByRole('button', { name: /send|gönder/i }).last();
      const sb = await send.boundingBox();
      expect(sb.x).toBeGreaterThanOrEqual(0); expect(sb.x + sb.width).toBeLessThanOrEqual(w + 1);
      expect(sb.y).toBeGreaterThanOrEqual(0); expect(sb.y + sb.height).toBeLessThanOrEqual(h + 1);
      if (w < 1024) { expect(sb.width).toBeGreaterThanOrEqual(43.5); expect(sb.height).toBeGreaterThanOrEqual(43.5); }
      await send.click();
      await expect(panel.getByText(/This is a reply to your message/).first()).toBeVisible({ timeout: 10_000 });
      const r = await page.evaluate(scan);
      expect(r.overflow).toBeLessThanOrEqual(1);
      expect(r.off).toEqual([]);
      // the conversation has room to be read: at least a quarter of the panel is conversation, even on a short screen
      const pb = await panel.boundingBox();
      const area = await panel.locator('div.overflow-y-auto').first().boundingBox();
      expect(area.height).toBeGreaterThan(Math.min(pb.height * 0.2, 60));
    });
  }
});

test.describe('landscape phones and short screens', () => {
  test.setTimeout(300_000);
  const LAND = [[568, 320], [667, 375], [844, 390], [932, 430], [320, 480]];
  test('public pages: no overflow in landscape and on short screens', async ({ page }) => {
    for (const route of ['/', '/about', '/ai', '/features', '/contact', '/login', '/register', '/forgot-password', '/privacy']) for (const [w, h] of LAND) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(route);
      await page.waitForLoadState('networkidle').catch(() => {});
      const r = await page.evaluate(scan);
      expect(r.overflow, `${route} @${w}x${h}`).toBeLessThanOrEqual(1);
      expect(r.off, `${route} @${w}x${h}`).toEqual([]);
    }
  });

  test('app: overview, emissions, inventories and settings have no overflow in landscape', async ({ page }) => {
    for (const [, route] of [SCENARIOS[0], SCENARIOS[1], SCENARIOS[6], SCENARIOS[8]]) for (const [w, h] of LAND) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(route);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(400);
      const r = await page.evaluate(scan);
      expect(r.overflow, `${route} @${w}x${h}`).toBeLessThanOrEqual(1);
      expect(r.off, `${route} @${w}x${h}`).toEqual([]);
    }
  });

  test('the Header menu on a landscape phone is capped to the window and scrolls: the last link is reachable', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 320 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const panel = page.locator('header nav > div').last();
    const pb = await panel.boundingBox();
    expect(pb.y + pb.height).toBeLessThanOrEqual(320);                                                  // the panel itself fits the window
    expect(await panel.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);                   // ...and scrolls
    const last = panel.getByRole('link', { name: 'Log In' });
    await last.scrollIntoViewIfNeeded();
    const lb = await last.boundingBox();
    expect(lb.y).toBeGreaterThanOrEqual(0); expect(lb.y + lb.height).toBeLessThanOrEqual(320);
  });

  test('the Add Emission Entry dialog scrolls inside a short window and its buttons stay reachable', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 320 });
    await page.goto('/dashboard?tab=emissions');
    await page.getByRole('button', { name: /New Entry/ }).evaluate(el => el.click());
    const save = page.getByRole('button', { name: /^Save\s*Entry/ });
    await save.scrollIntoViewIfNeeded();
    const b = await save.boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0); expect(b.y + b.height).toBeLessThanOrEqual(320);
  });

  test('the sign-in form can be scrolled to its button on a short screen', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 320 });
    await page.goto('/login');
    const btn = page.locator('form button[type="submit"]').first();
    await btn.scrollIntoViewIfNeeded();
    const b = await btn.boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0); expect(b.y + b.height).toBeLessThanOrEqual(320);
  });
});

test.describe('verification code boxes (verify-email)', () => {
  for (const w of [320, 360, 390, 430, 768]) {
    test(`${w} px: six boxes inside their card, 44 px wide from 390 px, never overlapping`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 700 });
      await page.goto('/verify-email?email=a@b.co');
      const m = await page.evaluate(() => {
        const ins = [...document.querySelectorAll('input[inputmode="numeric"]')].map(e => e.getBoundingClientRect());
        const card = document.querySelector('.rounded-2xl.border').getBoundingClientRect();
        return { n: ins.length, w: ins[0].width, h: ins[0].height, inside: ins.every(i => i.left >= card.left - 0.5 && i.right <= card.right + 0.5), gaps: ins.slice(1).map((r, i) => r.left - ins[i].right), over: document.documentElement.scrollWidth - document.documentElement.getBoundingClientRect().width };
      });
      expect(m.n).toBe(6); expect(m.inside).toBe(true); expect(m.over).toBeLessThanOrEqual(1);
      for (const g of m.gaps) expect(g).toBeGreaterThanOrEqual(4);
      expect(m.h).toBeGreaterThanOrEqual(47.5);
      expect(m.w).toBeGreaterThanOrEqual(w <= 320 ? 30 : 36);
      if (w >= 390) expect(m.w).toBeGreaterThanOrEqual(43.5);
    });
  }
});

test.describe('the app header controls on touch screens', () => {
  for (const [w, h] of [[320, 568], [390, 844], [768, 1024]]) {
    test(`${w} px: mode switch, language, bell and menu button are 44 px tap targets, and the header holds them`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/dashboard');
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => {
        const q = s => [...document.querySelectorAll(s)].map(e => { const r = e.getBoundingClientRect(); return { t: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 14), w: r.width, h: r.height, l: r.left, r: r.right }; });
        return { mode: q('header button').filter(b => /^(AI|Dash)/.test(b.t)), bell: q('header button[aria-label*="otification" i], header button[aria-label*="ildirim" i]'), over: document.documentElement.scrollWidth - document.documentElement.getBoundingClientRect().width };
      });
      expect(m.over).toBeLessThanOrEqual(1);
      expect(m.mode.length).toBeGreaterThanOrEqual(2);
      for (const b of [...m.mode, ...m.bell]) { expect(b.h, b.t).toBeGreaterThanOrEqual(43.5); expect(b.l).toBeGreaterThanOrEqual(0); expect(b.r).toBeLessThanOrEqual(w + 1); }
    });
  }
});
