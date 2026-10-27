'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

// Floating round Carbon AI button. The chat itself is InventoryAssistant
// (floating mode); this only opens/closes it. The tooltip shows on hover and
// keyboard focus, and once for a few seconds per browser session so the button
// is discoverable without staying in the way.
//
// It shows the same sphere as the chat's "How can I assist?" welcome screen.
// While the panel is open the button is hidden (not unmounted) so there is only
// ever one launcher on screen, and keyboard focus can return to it on close.
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

  const label = tr ? 'Yardıma mı ihtiyacınız var? Carbon AI\'ya sorun' : 'Need help? Ask Carbon AI';

  return (
    <div className={`group fixed right-4 z-[100] sm:right-6 ${open ? 'hidden' : ''} ${className}`}>
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
        className="relative flex h-14 w-14 items-center justify-center rounded-full border border-[#DEFAE1] bg-white/95 shadow-[0_6px_20px_-6px_rgba(42,189,65,0.40)] backdrop-blur-md transition hover:scale-105 hover:shadow-[0_8px_26px_-6px_rgba(42,189,65,0.50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A7B2A] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:h-16 sm:w-16"
      >
        {/* The welcome-screen sphere, cropped to a square so it fills the circle. */}
        <span className="block h-10 w-10 overflow-hidden rounded-full sm:h-11 sm:w-11">
          <Image src={LAUNCHER_IMG} alt="" width={88} height={88} className="h-full w-full object-cover" />
        </span>
        <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#2ABD41]" />
      </button>
    </div>
  );
}
