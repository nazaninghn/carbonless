/**
 * Smoke test — the shared Footer is plain white on every page that uses it.
 *
 * What it proves (home, About, AI, Features, Contact; English and Turkish; desktop and phone):
 *  - the footer and its card are #FFFFFF: no gradient, no tinted panel, no blurred colour blobs, no backdrop blur, no leaf watermark
 *  - the pixels at the footer's margins are pure white
 *  - every text colour is at least 4.5:1 on white (WCAG AA)
 *  - layout, content and links are unchanged (brand, tagline, three link columns, LinkedIn, copyright), no horizontal overflow
 */
import { test, expect } from '@playwright/test';
import sharp from 'sharp';

const PAGES = ['/', '/about', '/ai', '/features', '/contact'];
const SIZES = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];

/** WCAG contrast against white of an sRGB triple that is already blended over white */
const contrast = ([r, g, b]) => {
  const lin = [r, g, b].map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 1.05 / (0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2] + 0.05);
};

for (const path of PAGES) {
  for (const lang of ['en', 'tr']) {
    for (const size of SIZES) {
      test(`${lang} ${size.width} ${path}: the Footer is plain white, readable, and intact`, async ({ page }) => {
        await page.setViewportSize(size);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript(l => { localStorage.setItem('language', l); localStorage.setItem('language_explicit', '1'); }, lang);
        await page.goto(path);
        const footer = page.locator('footer').last();
        await expect(footer).toBeAttached();
        await footer.scrollIntoViewIfNeeded();
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
        await page.waitForTimeout(300);

        const f = await footer.evaluate(el => {
          const cs = e => getComputedStyle(e);
          const card = el.querySelector(':scope > div > div');
          const all = [el, ...el.querySelectorAll('*')];
          const texts = [...el.querySelectorAll('p, h4, a, span, li')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
          return {
            bg: cs(el).backgroundColor, img: cs(el).backgroundImage, cardBg: cs(card).backgroundColor, cardImg: cs(card).backgroundImage,
            blurs: all.filter(e => !e.matches('.btn-glass') && (cs(e).backdropFilter !== 'none' || cs(e).filter !== 'none')).length,   // (the small LinkedIn button keeps the site's shared glass-button style)
            tinted: all.filter(e => { const b = cs(e).backgroundColor; return b !== 'rgba(0, 0, 0, 0)' && b !== 'rgb(255, 255, 255)' && e.getBoundingClientRect().width > 100 && e.tagName !== 'A' && !e.closest('a'); }).length,
            imgs: [...el.querySelectorAll('img')].map(i => decodeURIComponent(i.currentSrc || i.src).split('/').pop()),
            // each text colour, painted over white on a canvas, so translucent / colour-space values come back as plain sRGB
            colors: texts.map(e => {
              const c = document.createElement('canvas'); c.width = c.height = 1;
              const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 1, 1); x.fillStyle = cs(e).color; x.fillRect(0, 0, 1, 1);
              return [e.textContent.trim().slice(0, 24), cs(e).color, [...x.getImageData(0, 0, 1, 1).data].slice(0, 3)];
            }),
            links: [...el.querySelectorAll('a')].map(a => a.getAttribute('href')),
            text: el.textContent,
            overflowX: document.documentElement.scrollWidth - innerWidth,
          };
        });
        // plain white: no gradient, no tinted panel, no blur, no watermark
        expect(f.bg).toBe('rgb(255, 255, 255)'); expect(f.img).toBe('none');
        expect(f.cardBg).toBe('rgb(255, 255, 255)'); expect(f.cardImg).toBe('none');
        expect(f.blurs).toBe(0);
        expect(f.tinted).toBe(0);
        expect(f.imgs).toEqual(['carbonless.png']);                                             // only the logo: no leaf watermark
        // readable: every text colour is at least 4.5:1 on white
        for (const [t, css, rgb] of f.colors) expect(contrast(rgb), `${t} ${css}`).toBeGreaterThanOrEqual(4.5);
        // content and links as before
        expect(f.links).toEqual(['/', 'https://www.linkedin.com/company/carbonless-network', '/features', '/ai', '/#pricing', '/#faq', '/register', '/about', '/contact', '/login', '/register', '/privacy', '/terms']);
        expect(f.text).toContain('Carbonless');
        expect(f.text).toContain(lang === 'tr' ? 'Tüm hakları saklıdır.' : 'All rights reserved.');
        expect(f.text).toContain(lang === 'tr' ? 'Yasal' : 'Legal');
        expect(f.overflowX).toBeLessThanOrEqual(0);

        // real pixels: the strips left and right of the card, and the page's last rows, are pure white
        const b = await footer.evaluate(el => { const r = el.getBoundingClientRect(); return { y: r.y, h: r.height }; });
        const clipH = Math.min(b.h, size.height - Math.max(0, b.y));
        const clipY = Math.max(0, b.y);
        const shot = await page.screenshot({ clip: { x: 0, y: clipY, width: size.width, height: Math.max(8, Math.min(clipH, size.height - clipY)) } });
        const { data, info } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
        const px = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
        // white, allowing only the card's own soft drop shadow (a faint, neutral grey: never a green tint)
        const nearWhite = ([r, g, b]) => Math.min(r, g, b) >= 244 && Math.max(r, g, b) - Math.min(r, g, b) <= 3;
        for (const y of [2, Math.floor(info.height / 2), info.height - 2]) expect(nearWhite(px(1, y)), `pixel left y=${y} ${px(1, y)}`).toBe(true);
        if (size.width > 500) expect(nearWhite(px(size.width - 24, Math.floor(info.height / 2)))).toBe(true);   // (desktop only: on a phone the card fills the width; also inside the browser's own scrollbar gutter)
      });
    }
  }
}
