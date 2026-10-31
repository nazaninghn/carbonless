/**
 * Smoke test — the floating Carbon AI assistant on the dashboard.
 *
 *  - the round button is on every dashboard section; it opens a compact panel over the page (not a full-screen page)
 *  - three sizes: floating (compact card) -> expanded (larger, dashboard still visible) -> full screen; Restore steps back
 *  - Minimize and Close return to the round button; Escape closes; nothing resets the conversation
 *  - switching size, closing or changing section while a reply is on its way does not lose it
 *  - the dashboard behind the compact panel stays usable; the panel never overflows the viewport
 *
 * The chat backend is mocked with a tiny in-memory store (a session, its messages), so a reload of the session returns
 * what was sent, as the real one does.
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

async function setup(page, size = { width: 1440, height: 900 }, { replyDelay = 300 } = {}) {
  await page.setViewportSize(size);
  await mockDjangoApi(page);
  const store = { sessions: [], messages: {}, sent: 0 };
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  // registered after mockDjangoApi, so these win for the chat endpoints
  await page.route(/\/api\/chat\/sessions\/.*/, async route => {
    const url = route.request().url(), method = route.request().method();
    let m;
    if (/\/chat\/sessions\/$/.test(url) && method === 'GET') return json(route, store.sessions);
    if (/\/chat\/sessions\/new\/$/.test(url)) {
      const s = { id: 7, title: 'New Chat', updated_at: new Date().toISOString(), message_count: 0 };
      store.sessions.unshift(s); store.messages[7] = [];
      return json(route, s, 201);
    }
    if ((m = url.match(/\/chat\/sessions\/(\d+)\/message\/$/))) {
      const { content } = JSON.parse(route.request().postData() || '{}');
      store.sent++;
      const id = Number(m[1]);
      store.messages[id].push({ id: 100 + store.sent * 2, role: 'user', content });
      await new Promise(r => setTimeout(r, replyDelay));
      const reply = { id: 101 + store.sent * 2, role: 'assistant', content: `Reply ${store.sent}: noted "${content}".` };
      store.messages[id].push(reply);
      return json(route, reply);
    }
    if ((m = url.match(/\/chat\/sessions\/(\d+)\/$/))) return json(route, { id: Number(m[1]), messages: store.messages[m[1]] || [] });
    return json(route, []);
  });
  await seedAuth(page);
  await page.goto('/dashboard');
  await expect(launcher(page)).toBeVisible({ timeout: 20_000 });
  return store;
}

const launcher = page => page.getByRole('button', { name: /Ask Carbon AI|Carbon AI'ya sorun/ });
const panel = page => page.getByTestId('ai-assistant-panel');
const box = page => panel(page).evaluate(el => {
  const r = el.getBoundingClientRect();
  // The visible area, as a fixed box sees it: the page reserves a scrollbar gutter (scrollbar-gutter: stable) that the
  // browser paints over fixed content, so innerWidth / clientWidth can be wider than what is really on screen.
  const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe); const v = probe.getBoundingClientRect(); probe.remove();
  return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, vw: v.width, vh: v.height,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, mode: el.dataset.mode, open: el.dataset.open };
});
const settle = page => page.waitForTimeout(450);   // the size / open transitions are 0.32 s at most

async function send(page, text) {
  const input = panel(page).locator('textarea');
  await input.fill(text);
  await input.press('Enter');
}

test('desktop: opens a compact panel over the dashboard, which stays usable', async ({ page }) => {
  await setup(page);
  await expect(panel(page)).toHaveAttribute('data-open', 'false');
  await launcher(page).click();
  await settle(page);
  const b = await box(page);
  expect(b).toMatchObject({ open: 'true', mode: 'floating' });
  expect(b.w).toBeGreaterThanOrEqual(380); expect(b.w).toBeLessThanOrEqual(420);
  expect(b.h).toBeGreaterThanOrEqual(540); expect(b.h).toBeLessThanOrEqual(620);
  expect(b.vw - b.right).toBeGreaterThanOrEqual(16); expect(b.vh - b.bottom).toBeGreaterThanOrEqual(16);   // in the corner, off the edges
  expect(b.overflowX).toBeLessThanOrEqual(0);
  await expect(launcher(page)).toBeHidden();                                 // one control on screen at a time
  await expect(panel(page).locator('textarea')).toBeFocused();               // ready to type
  // not modal: the dashboard behind it still works (switch section from the sidebar)
  expect(await panel(page).getAttribute('aria-modal')).toBeNull();
  await page.getByRole('button', { name: /^Emissions$/ }).first().click();
  await expect(panel(page)).toHaveAttribute('data-open', 'true');            // and the chat stays open across sections
  // Close returns to the round button
  await page.getByTestId('ai-assistant-close').click();
  await settle(page);
  await expect(panel(page)).toHaveAttribute('data-open', 'false');
  await expect(panel(page)).toBeHidden();
  await expect(launcher(page)).toBeVisible();
  await expect(launcher(page)).toBeFocused();                                // focus goes back to the button
});

test('three sizes: expand, full screen, restore; the conversation survives every switch, minimize, close and section change', async ({ page }) => {
  const store = await setup(page, { width: 1440, height: 900 }, { replyDelay: 1200 });
  await launcher(page).click();
  await send(page, 'We used 14000 kWh of electricity');
  await expect(panel(page).getByText('Reply 1: noted')).toBeVisible({ timeout: 10_000 });

  // a second question, and while its reply is on its way: switch sizes
  await send(page, 'And 500 litres of diesel');
  await page.getByTestId('ai-assistant-expand').click();
  await settle(page);
  let b = await box(page);
  expect(b.mode).toBe('expanded');
  expect(b.w).toBeGreaterThan(600); expect(b.x).toBeGreaterThan(100);       // larger, part of the dashboard still visible
  expect(b.h).toBeGreaterThan(700);
  await page.getByTestId('ai-assistant-expand').click();                     // -> full screen
  await settle(page);
  b = await box(page);
  expect(b).toMatchObject({ mode: 'fullscreen', x: 0, y: 0 });
  expect(b.w).toBe(b.vw); expect(b.h).toBe(b.vh);
  expect(await panel(page).getAttribute('aria-modal')).toBe('true');
  await expect(page.getByTestId('ai-assistant-expand')).toHaveCount(0);       // already as big as it gets
  await expect(panel(page).getByText('Reply 2: noted')).toBeVisible({ timeout: 10_000 });   // the reply arrived, not lost
  expect(store.sent).toBe(2);

  // restore steps back one size at a time
  await page.getByTestId('ai-assistant-restore').click(); await settle(page);
  expect((await box(page)).mode).toBe('expanded');
  await page.getByTestId('ai-assistant-restore').click(); await settle(page);
  expect((await box(page)).mode).toBe('floating');
  await expect(page.getByTestId('ai-assistant-restore')).toHaveCount(0);

  // minimize keeps the size for next time; the conversation is still there
  await page.getByTestId('ai-assistant-expand').click(); await settle(page);
  await page.getByTestId('ai-assistant-minimize').click(); await settle(page);
  await expect(panel(page)).toBeHidden();
  await page.getByRole('button', { name: /^Targets$/ }).first().click();    // browse another section meanwhile
  await launcher(page).click(); await settle(page);
  expect((await box(page)).mode).toBe('expanded');
  for (const t of ['We used 14000 kWh of electricity', 'Reply 1: noted', 'And 500 litres of diesel', 'Reply 2: noted'])
    await expect(panel(page).getByText(t, { exact: false }).first()).toBeVisible();

  // Escape closes (and, like Close, starts the next opening as the compact card); the conversation remains
  await page.keyboard.press('Escape'); await settle(page);
  await expect(panel(page)).toBeHidden();
  await launcher(page).click(); await settle(page);
  expect((await box(page)).mode).toBe('floating');
  await expect(panel(page).getByText('Reply 2: noted')).toBeVisible();
  expect(store.sent).toBe(2);
});

test('keyboard: the button opens it, Tab stays inside only in full screen, Escape closes back to the button', async ({ page }) => {
  await setup(page);
  await launcher(page).focus();
  await page.keyboard.press('Enter');
  await expect(panel(page).locator('textarea')).toBeFocused();
  await page.getByTestId('ai-assistant-expand').click();
  await page.getByTestId('ai-assistant-expand').click();
  await settle(page);
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    expect(await panel(page).evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape'); await settle(page);
  await expect(panel(page)).toBeHidden();
  await expect(launcher(page)).toBeFocused();
});

const sizes = [
  { name: 'phone 360', width: 360, height: 740 }, { name: 'phone 390', width: 390, height: 844 },
  { name: 'tablet 768', width: 768, height: 1024 }, { name: 'tablet 1024', width: 1024, height: 768 },
  { name: 'desktop 1280', width: 1280, height: 720 }, { name: 'desktop 1920', width: 1920, height: 1080 },
];
for (const s of sizes) {
  test(`${s.name}: every size fits the viewport, nothing overflows`, async ({ page }) => {
    await setup(page, s);
    await launcher(page).click(); await settle(page);
    let b = await box(page);
    // compact: never the whole screen; near full width with small margins on a phone, a card from 640px up
    expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThan(0);
    expect(b.right).toBeLessThanOrEqual(b.vw); expect(b.bottom).toBeLessThanOrEqual(b.vh);
    if (s.width < 640) { expect(b.w).toBeGreaterThanOrEqual(b.vw - 24); expect(b.w).toBeLessThan(b.vw); expect(b.y).toBeGreaterThanOrEqual(60); }
    else { expect(b.w).toBeLessThanOrEqual(420); }
    expect(b.overflowX).toBeLessThanOrEqual(0);
    await page.getByTestId('ai-assistant-expand').click(); await settle(page);
    b = await box(page);
    expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(b.vw); expect(b.bottom).toBeLessThanOrEqual(b.vh);
    if (s.width >= 1024) expect(b.x).toBeGreaterThan(100);                   // the dashboard still shows beside it
    await page.getByTestId('ai-assistant-expand').click(); await settle(page);
    b = await box(page);
    expect([b.x, b.y, b.w, b.h]).toEqual([0, 0, b.vw, b.vh]);
    expect(b.overflowX).toBeLessThanOrEqual(0);
    // the header buttons fit (Restore, Minimize, Close) and the message box is usable
    for (const id of ['ai-assistant-restore', 'ai-assistant-minimize', 'ai-assistant-close']) await expect(page.getByTestId(id)).toBeInViewport();
    await expect(panel(page).locator('textarea')).toBeInViewport();
  });
}

test('Turkish labels on the panel buttons', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('language', 'tr'); localStorage.setItem('language_explicit', '1'); });
  await setup(page);
  await launcher(page).click(); await settle(page);
  await expect(page.getByTestId('ai-assistant-expand')).toHaveAttribute('aria-label', 'Büyüt');
  await expect(page.getByTestId('ai-assistant-minimize')).toHaveAttribute('aria-label', 'Simge durumuna küçült');
  await expect(page.getByTestId('ai-assistant-close')).toHaveAttribute('aria-label', 'Kapat');
  await page.getByTestId('ai-assistant-expand').click();
  await expect(page.getByTestId('ai-assistant-expand')).toHaveAttribute('aria-label', 'Tam ekran');
  await expect(page.getByTestId('ai-assistant-restore')).toHaveAttribute('aria-label', 'Önceki boyuta dön');
});

test('reduced motion: no transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await launcher(page).click();
  expect(await panel(page).evaluate(el => getComputedStyle(el).transitionDuration.split(',').every(d => parseFloat(d) === 0))).toBe(true);
});

/* -- Dragging --
   The header is the handle (pointer: mouse and touch); the grip button in it also moves the panel with the arrow keys.
   The panel always stays whole on screen (8px from every edge), keeps its place across compact / expanded and while
   minimised, and full screen ignores it until Restore brings the panel back to where it was. */
const rect = async page => { const b = await box(page); return { ...b, x: Math.round(b.x), y: Math.round(b.y), right: Math.round(b.right), bottom: Math.round(b.bottom) }; };
async function mouseDrag(page, from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 5 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 5 });
  await page.mouse.up();
}
// a point on the header's title (not on a button)
const grabPoint = async page => { const t = await page.getByTestId('ai-assistant-header').locator('p').first().boundingBox(); return { x: t.x + 20, y: t.y + t.height / 2 }; };
// (negative when the page reserves a scrollbar gutter it does not need: that is room to spare, not overflow)
const expectNoOverflow = async page => {
  const o = await page.evaluate(() => ({ x: document.documentElement.scrollWidth - document.documentElement.clientWidth, y: document.documentElement.scrollHeight - document.documentElement.clientHeight }));
  expect(o.x).toBeLessThanOrEqual(0); expect(o.y).toBeLessThanOrEqual(0);
};
async function openPanel(page) { await launcher(page).click(); await settle(page); }

test('drag: the compact panel follows the header, with a grab cursor and a grip', async ({ page }) => {
  await setup(page);
  await openPanel(page);
  const header = page.getByTestId('ai-assistant-header');
  expect(await header.evaluate(el => getComputedStyle(el).cursor)).toBe('grab');
  await expect(page.getByTestId('ai-assistant-move')).toBeVisible();
  const a = await rect(page);
  await mouseDrag(page, await grabPoint(page), -500, -200);
  const b = await rect(page);
  expect(b.x - a.x).toBe(-500); expect(b.y - a.y).toBe(-200);
  expect([b.w, b.h]).toEqual([a.w, a.h]);                                    // moved, not resized
  expect(b).toMatchObject({ mode: 'floating', open: 'true' });
  await expectNoOverflow(page);
  // the chat works where it now is
  await send(page, 'hello from the new place');
  await expect(panel(page).getByText('Reply 1: noted')).toBeVisible({ timeout: 10_000 });
});

test('drag: the expanded panel moves too', async ({ page }) => {
  await setup(page);
  await openPanel(page);
  await page.getByTestId('ai-assistant-expand').click(); await settle(page);
  const a = await rect(page);
  expect(a.mode).toBe('expanded');
  await mouseDrag(page, await grabPoint(page), -300, 0);
  const b = await rect(page);
  expect(b.x - a.x).toBe(-300); expect(b.y).toBe(a.y);
});

test('drag: the panel cannot leave the screen, at any size of window', async ({ page }) => {
  await setup(page);
  await openPanel(page);
  await mouseDrag(page, await grabPoint(page), -5000, -5000);              // far past the top-left corner
  let b = await rect(page);
  expect(b.x).toBe(8); expect(b.y).toBe(8);
  await mouseDrag(page, await grabPoint(page), 5000, 5000);                // far past the bottom-right corner
  b = await rect(page);
  expect(b.vw - b.right).toBe(8); expect(b.vh - b.bottom).toBe(8);
  // the window shrinks: the panel moves in so all of it stays visible
  await mouseDrag(page, await grabPoint(page), -5000, -5000);
  await page.setViewportSize({ width: 900, height: 700 }); await settle(page);
  b = await rect(page);
  expect(b.x).toBeGreaterThanOrEqual(8); expect(b.y).toBeGreaterThanOrEqual(8);
  expect(b.right).toBeLessThanOrEqual(b.vw - 8); expect(b.bottom).toBeLessThanOrEqual(b.vh - 8);
  await expectNoOverflow(page);
});

test('drag: never set off by, or setting off, the header buttons', async ({ page }) => {
  await setup(page);
  await openPanel(page);
  const a = await rect(page);
  // pressing on Expand and moving does not drag the panel...
  const exp = await page.getByTestId('ai-assistant-expand').boundingBox();
  await page.mouse.move(exp.x + exp.width / 2, exp.y + exp.height / 2);
  await page.mouse.down(); await page.mouse.move(exp.x - 250, exp.y + 150, { steps: 8 }); await page.mouse.up();
  let b = await rect(page);
  expect([b.x, b.y, b.mode]).toEqual([a.x, a.y, 'floating']);              // ...and released elsewhere it does not click
  // a drag that ends on top of Close does not close the panel
  const g = await grabPoint(page);
  const close = await page.getByTestId('ai-assistant-close').boundingBox();
  await mouseDrag(page, g, close.x + close.width / 2 - g.x, close.y + close.height / 2 - g.y);
  b = await rect(page);
  expect(b.open).toBe('true');
  // the buttons still work with a plain click
  await page.getByTestId('ai-assistant-expand').click(); await settle(page);
  expect((await rect(page)).mode).toBe('expanded');
});

test('drag: the place is kept when minimised and reopened, and across compact / expanded', async ({ page }) => {
  await setup(page);
  await openPanel(page);
  await mouseDrag(page, await grabPoint(page), -600, -150);
  const placed = await rect(page);
  await page.getByTestId('ai-assistant-minimize').click(); await settle(page);
  await expect(launcher(page)).toBeVisible();
  const btn = await launcher(page).boundingBox();                          // the round button stays in its corner
  expect(Math.round(btn.x + btn.width)).toBeGreaterThan(placed.vw - 60);
  await launcher(page).click(); await settle(page);
  let b = await rect(page);
  expect([b.x, b.y]).toEqual([placed.x, placed.y]);
  // larger, it keeps its corner where the user put it, moved in only as far as it must to stay whole on screen
  // (here the wider panel has to come right a little to keep 8px on the left), and comes back exactly
  await page.getByTestId('ai-assistant-expand').click(); await settle(page);
  b = await rect(page);
  expect(b.right).toBe(Math.max(placed.right, 8 + Math.round(b.w)));
  expect(b.x).toBeGreaterThanOrEqual(8);
  expect(b.y).toBeGreaterThanOrEqual(8); expect(b.bottom).toBeLessThanOrEqual(b.vh - 8);
  await page.getByTestId('ai-assistant-restore').click(); await settle(page);
  b = await rect(page);
  expect([b.x, b.y, b.mode]).toEqual([placed.x, placed.y, 'floating']);
});

test('drag: off in full screen; Restore brings the panel back to where it was', async ({ page }) => {
  await setup(page);
  await openPanel(page);
  await page.getByTestId('ai-assistant-expand').click(); await settle(page);
  await mouseDrag(page, await grabPoint(page), -250, 0);
  const placed = await rect(page);
  await page.getByTestId('ai-assistant-expand').click(); await settle(page);   // full screen
  let b = await rect(page);
  expect([b.x, b.y, b.w, b.h]).toEqual([0, 0, b.vw, b.vh]);
  await expect(page.getByTestId('ai-assistant-move')).toHaveCount(0);
  expect(await page.getByTestId('ai-assistant-header').evaluate(el => getComputedStyle(el).cursor)).not.toBe('grab');
  await mouseDrag(page, await grabPoint(page), 300, 200);
  b = await rect(page);
  expect([b.x, b.y]).toEqual([0, 0]);                                       // it did not move
  await page.getByTestId('ai-assistant-restore').click(); await settle(page);
  b = await rect(page);
  expect([b.x, b.y, b.mode]).toEqual([placed.x, placed.y, 'expanded']);
});

test('drag: keyboard - the grip moves it with the arrow keys, Home puts it back in the corner', async ({ page }) => {
  await setup(page);
  await openPanel(page);
  const a = await rect(page);
  await page.getByTestId('ai-assistant-move').focus();
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Shift+ArrowLeft');
  await settle(page);
  let b = await rect(page);
  expect(b.x - a.x).toBe(-(16 + 16 + 64)); expect(b.y - a.y).toBe(-16);
  await expect(page.getByTestId('ai-assistant-move')).toBeFocused();
  await page.keyboard.press('Home'); await settle(page);
  b = await rect(page);
  expect([b.x, b.y]).toEqual([a.x, a.y]);
});

test.describe('touch', () => {
  test.use({ hasTouch: true });
  test('phone: a finger on the header moves the panel; the page does not scroll', async ({ page }) => {
    await setup(page, { width: 390, height: 844 });
    await openPanel(page);
    const a = await rect(page);
    const g = await grabPoint(page);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const scroll = () => page.evaluate(() => [scrollY, document.getElementById('main-content')?.scrollTop ?? 0]);
    const scrollBefore = await scroll();
    // up 300px (the compact panel starts low on a phone, leaving the top of the page visible)
    await touch('touchStart', g.x, g.y);
    for (let i = 1; i <= 10; i++) await touch('touchMove', g.x, g.y - 30 * i);
    await touch('touchEnd');
    await settle(page);
    const b = await rect(page);
    expect(b.y).toBeLessThan(a.y);
    expect(b.y).toBeGreaterThanOrEqual(8);
    expect(b.x).toBeGreaterThanOrEqual(8); expect(b.right).toBeLessThanOrEqual(b.vw - 8);
    expect(await scroll()).toEqual(scrollBefore);                           // the page under it did not scroll
    // and back down
    const g2 = await grabPoint(page);
    await touch('touchStart', g2.x, g2.y);
    for (let i = 1; i <= 10; i++) await touch('touchMove', g2.x, g2.y + 40 * i);
    await touch('touchEnd');
    await settle(page);
    const c = await rect(page);
    expect(c.y).toBeGreaterThan(b.y);
    expect(c.bottom).toBeLessThanOrEqual(c.vh - 8);
    // only the header takes over touch; the conversation scrolls as usual
    expect(await page.getByTestId('ai-assistant-header').evaluate(el => getComputedStyle(el).touchAction)).toBe('none');
    expect(await panel(page).locator('textarea').evaluate(el => getComputedStyle(el).touchAction)).not.toBe('none');
    await expectNoOverflow(page);
  });
});
