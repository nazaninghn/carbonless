'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

// Floating round Carbon AI button, on every dashboard section. The chat itself
// is InventoryAssistant (floating mode); this only opens it (the panel's own
// buttons minimise and close it). The tooltip shows on hover and
// keyboard focus, and once for a few seconds per browser session so the button
// is discoverable without staying in the way.
//
// It shows the same sphere as the chat's "How can I assist?" welcome screen.
// While the panel is open the button is hidden (not unmounted) so there is only
// ever one launcher on screen, and keyboard focus can return to it on close.
//
// On screens narrower than 1024px it must not sit over content (it used to cover "Edit", "Delete" and other row buttons
// at the right edge): like a Material floating button it slides away while the page is scrolled down and while a text
// field is focused (the on-screen keyboard is up), and comes back when scrolling up, at the top or the bottom of the
// page, and whenever it receives keyboard focus, so it is always one scroll or Tab away. It is 48px on phones (64 from 640px, as before).
// Its stacking level (45) is above the page and the bottom navigation (40) but BELOW every dialog, drawer and sheet (50 and up), so it
// never sits on top of a dialog's buttons (it used to cover "Save Entry" in the Add Emission Entry dialog).
const HINT_KEY = 'carbonless_ai_hint_seen';
const LAUNCHER_IMG = '/carbon-hero.png';

export default function CarbonAILauncher({ open, onToggle, language, className = '' }) {
  const tr = language === 'tr';
  const [hint, setHint] = useState(false);
  const btnRef = useRef(null);
  const wasOpen = useRef(open);

  // Closing the panel returns focus to the launcher, unless the user has
  // already moved focus somewhere else on purpose.
  useEffect(() => {
    if (wasOpen.current && !open) {
      const raf = requestAnimationFrame(() => {
        const a = document.activeElement;
        if (!a || a === document.body) btnRef.current?.focus({ preventScroll: true });
      });
      wasOpen.current = open;
      return () => cancelAnimationFrame(raf);
    }
    wasOpen.current = open;
    return undefined;
  }, [open]);

  useEffect(() => {
    let seen = true;
    try { seen = sessionStorage.getItem(HINT_KEY) === '1'; } catch { /* hint just shows again */ }
    if (seen) return undefined;
    const show = setTimeout(() => setHint(true), 900);
    const hide = setTimeout(() => {
      setHint(false);
      try { sessionStorage.setItem(HINT_KEY, '1'); } catch { /* ignore */ }
    }, 7000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, []);

  // Narrow screens: slide away while scrolling down or typing; back on scroll up, at either end, or on focus.
  const [away, setAway] = useState(false);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const tops = new WeakMap();
    const onScroll = (e) => {
      if (window.innerWidth >= 1024) { setAway(false); return; }
      const t = e.target === document ? document.scrollingElement : e.target;
      if (!(t instanceof Element) || t.closest('[role="dialog"], [data-testid="ai-assistant-panel"]')) return;
      const y = t.scrollTop;
      const prev = tops.get(t);
      tops.set(t, y);
      if (prev === undefined) return;
      const d = y - prev;
      const atEnd = y < 40 || y + t.clientHeight >= t.scrollHeight - 40;
      if (atEnd || d < -6) setAway(false);
      else if (d > 6) setAway(true);
    };
    const field = (el) => el instanceof Element && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable="true"]');
    const onIn = (e) => { if (window.innerWidth < 1024 && field(e.target)) setTyping(true); };
    const onOut = () => setTyping(false);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => { document.removeEventListener('scroll', onScroll, true); document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut); };
  }, []);
  const tuckedAway = away || typing;

  const label = tr ? 'Yardıma mı ihtiyacınız var? Carbon AI\'ya sorun' : 'Need help? Ask Carbon AI';

  return (
    <div
      data-testid="ai-launcher"
      data-away={tuckedAway ? 'true' : 'false'}
      className={`group fixed right-4 z-[45] sm:right-6 transition-[opacity,transform] duration-300 motion-reduce:transition-none ${tuckedAway ? 'max-lg:pointer-events-none max-lg:translate-y-4 max-lg:opacity-0' : ''} ${open ? 'hidden' : ''} ${className}`}
      onFocusCapture={() => setAway(false)}
    >
      {!open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute bottom-[calc(100%+10px)] max-sm:hidden right-0 w-max max-w-[210px] rounded-2xl bg-[#072C0E] px-3.5 py-2 text-center text-[12px] font-semibold leading-snug text-white shadow-lg transition-opacity duration-200 motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100 ${hint ? 'opacity-100' : 'opacity-0'}`}
        >
          {label}
        </span>
      )}
      <button
        ref={btnRef}
        type="button"
        onClick={onToggle}
        aria-label={open ? (tr ? 'Carbon AI\'yı kapat' : 'Close Carbon AI') : label}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[#DEFAE1] bg-white/95 shadow-[0_6px_20px_-6px_rgba(42,189,65,0.40)] backdrop-blur-md transition hover:scale-105 hover:shadow-[0_8px_26px_-6px_rgba(42,189,65,0.50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A7B2A] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:h-16 sm:w-16"
      >
        {/* The welcome-screen sphere, cropped to a square so it fills the circle. */}
        <span className="block h-9 w-9 overflow-hidden rounded-full sm:h-11 sm:w-11">
          <Image src={LAUNCHER_IMG} alt="" width={88} height={88} className="h-full w-full object-cover" />
        </span>
        <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#2ABD41]" />
      </button>
    </div>
  );
}
