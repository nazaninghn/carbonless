'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { SCOPES } from './heroContent';
import { SCOPE_INFO } from './scopeInfo';
import { SCOPE_POP } from './scopePop';

/* -- The Scope popover: a small, non-modal information panel next to the selected card --
   Wide layouts (1024+): it floats beside the card on the first side where it fits (outward, below, inward, above),
   never over another card and always inside the window; a small arrow points at the card.
   Narrower layouts: it opens in the flow directly under the selected card (phones) or under the row of cards
   (tablets), so the other cards stay where they are and stay clickable.
   Not a modal: focus stays on the card, the page keeps scrolling, Tab can leave; Escape, a click outside and the
   close button close it (HeroSection handles Escape and outside clicks). */
const GAP = 14;
const MARGIN = 12;
const HEADER = 84;     // the sticky site header covers the top 72px of the window

export default function ScopePopover({ scope, lang, copy, mode, visualRef, onClose }) {
  const id = useId();
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const info = (SCOPE_INFO[lang] ?? SCOPE_INFO.en)[scope];
  const pop = (SCOPE_POP[lang] ?? SCOPE_POP.en)[scope];
  const { icon: Icon } = SCOPES.find(s => s.key === scope);
  const index = SCOPES.findIndex(s => s.key === scope);

  useLayoutEffect(() => {
    if (mode !== 'wide') { setPos(null); return undefined; }
    const place = () => {
      const vis = visualRef.current, el = ref.current;
      if (!vis || !el) return;
      const vr = vis.getBoundingClientRect();
      const vw = document.documentElement.clientWidth, vh = window.innerHeight;
      const W = el.offsetWidth, H = el.offsetHeight;
      const slot = k => { const b = vis.querySelector(`[data-testid="hero-scope-${k}"]`).getBoundingClientRect(); return { x: b.left - vr.left, y: b.top - vr.top, w: b.width, h: b.height }; };
      // the headline block below the stage is an obstacle too: the popover never covers the headline or the buttons
      const copyEl = vis.parentElement.querySelector('.hero-copy');
      const cb = copyEl ? copyEl.getBoundingClientRect() : null;
      const R = slot(scope);
      const others = SCOPES.map(s => s.key).filter(k => k !== scope).map(slot);
      const obstacles = cb ? [...others, { x: cb.left - vr.left, y: cb.top - vr.top + 8, w: cb.width, h: cb.height }] : others;
      const isLeft = scope !== 's2';
      const copyTop = cb ? cb.top - vr.top + 8 : Infinity;
      const minY = HEADER - vr.top, maxView = vh - MARGIN - vr.top - H, maxCopy = Math.min(maxView, copyTop - 6 - H);
      const minX = MARGIN - vr.left, maxX = vw - MARGIN - vr.left - W;
      const clamp = (v, lo, hi) => (lo > hi ? lo : Math.min(Math.max(v, lo), hi));
      const make = (side, maxY) => {
        let x, y;
        if (side === 'left' || side === 'right') {
          // beside the card; on the left of the globe "inward" starts after the right-most of the cards stacked there
          const edge = Math.max(R.x + R.w, ...(isLeft ? others.filter(o => o.x + o.w / 2 < vr.width / 2).map(o => o.x + o.w) : []));
          x = side === 'left' ? R.x - GAP - W : (isLeft ? edge : R.x + R.w) + GAP;
          y = clamp(R.y + R.h / 2 - H / 2, minY, maxY);
        } else {
          y = side === 'below' ? R.y + R.h + GAP : R.y - GAP - H;
          x = clamp(isLeft ? R.x : R.x + R.w - W, minX, maxX);
        }
        const arrow = side === 'left' || side === 'right' ? clamp(R.y + R.h / 2 - y, 22, H - 22) : clamp(R.x + R.w / 2 - x, 22, W - 22);
        return { x, y, side, arrow };
      };
      const fits = (p, maxY) => p.x >= minX - 0.5 && p.x <= maxX + 0.5 && p.y >= minY - 0.5 && p.y <= maxY + 0.5;
      const clearOf = (list, p) => list.every(o => p.x + W + 4 <= o.x || p.x >= o.x + o.w + 4 || p.y + H + 6 <= o.y || p.y >= o.y + o.h + 6);
      const order = isLeft ? ['left', 'below', 'right', 'above'] : ['right', 'below', 'left', 'above'];
      // first choice: a place clear of the other cards AND the headline block; if the window is too short for that,
      // one clear of the other cards (the popover may then cover part of the headline while it is open)
      const tier1 = order.map(side => make(side, maxCopy));
      const tier2 = order.map(side => make(side, maxView));
      const best = tier1.find(p => fits(p, maxCopy) && clearOf(obstacles, p)) ?? tier2.find(p => fits(p, maxView) && clearOf(others, p))
        ?? tier2.find(p => clearOf(others, p) && p.x >= minX - 0.5 && p.x <= maxX + 0.5 && p.y >= minY - 0.5) ?? tier2[1];
      setPos(best);
      // (a last resort only: if it still hangs below the window, bring it into view)
      const overflow = vr.top + best.y + H - (vh - MARGIN);
      if (overflow > 0) window.scrollBy({ top: overflow, behavior: 'instant' });
    };
    place();
    window.addEventListener('resize', place);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    if (ro && visualRef.current) ro.observe(visualRef.current);
    return () => { window.removeEventListener('resize', place); ro?.disconnect(); };
  }, [mode, scope, lang, visualRef]);

  useEffect(() => {
    if (mode === 'wide') return;
    const el = ref.current;
    if (!el) return;
    const over = el.getBoundingClientRect().bottom - (window.innerHeight - MARGIN);
    if (over > 0) window.scrollBy({ top: over, behavior: 'instant' });
  }, [mode, scope]);

  // the arrow of the in-flow versions: phones point at the card's icon, tablets at the card's column
  const inlineArrow = mode === 'phone' ? '30px' : `${((index * 2 + 1) / 6) * 100}%`;
  const style = mode === 'wide'
    ? { left: pos ? pos.x : 0, top: pos ? pos.y : 0, visibility: pos ? 'visible' : 'hidden', '--arrow': pos ? `${pos.arrow}px` : '0px' }
    : { '--arrow': inlineArrow };
  const side = mode === 'wide' ? pos?.side : 'below';

  return (
    <div
      ref={ref}
      id={`${id}-pop`}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-title`}
      data-testid={`hero-scope-pop-${scope}`}
      data-mode={mode}
      data-side={side}
      className="hero-pop"
      style={style}
    >
      <span aria-hidden="true" className="hero-pop-arrow" />
      <button type="button" data-testid="hero-pop-close" className="hero-pop-close" aria-label={copy.ui.close} onClick={onClose}>
        <X aria-hidden="true" strokeWidth={2.2} />
      </button>

      <header className="hero-pop-head">
        <span aria-hidden="true" className="hero-pop-icon"><Icon strokeWidth={1.7} /></span>
        <div className="min-w-0">
          <p className="hero-pop-kicker">{copy.scopes[scope].title}</p>
          <h2 id={`${id}-title`} className="hero-pop-title">{pop.title}</h2>
        </div>
      </header>

      <p className="hero-pop-text">{info.meaning}</p>
      <h3 className="hero-pop-h">{copy.ui.examples}</h3>
      <ul className="hero-pop-list">{info.examples.slice(0, 3).map(t => <li key={t}>{t}</li>)}</ul>
      <h3 className="hero-pop-h">{copy.ui.why}</h3>
      <p className="hero-pop-text">{pop.why}</p>
    </div>
  );
}
