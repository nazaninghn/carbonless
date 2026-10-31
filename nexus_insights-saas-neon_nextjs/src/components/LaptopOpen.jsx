'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

/* -- Laptop that opens once (AI section) --
   public/ai-laptop.png is one picture of an open MacBook, so it is drawn twice and cut along the hinge line: the
   BASE (the aluminium deck, still) and the LID (screen), which swings up about the hinge like a real lid, with a
   perspective on the wrapper so the foreshortening is natural. It starts nearly closed (-68deg) and opens in 1.8 s with
   a slow start, no overshoot and a soft settle, then stays open. It is triggered the first time the laptop is mostly in
   view and never replays. With prefers-reduced-motion it is simply shown open. */
const W = 1402;
const H = 1122;
const HINGE = (896 / H) * 100;          // y of the hinge (top edge of the deck) in the picture, in %
const START_DEG = -68;
const OPEN_MS = 1800;

export default function LaptopOpen({ src, alt, className = '' }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true);
      setOpen(true);
      return undefined;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setOpen(true); return undefined; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setOpen(true); io.disconnect(); }     // once per page load
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} data-testid="laptop" data-open={open ? 'true' : 'false'} className={className}>
      <div
        className="relative drop-shadow-2xl transition-transform duration-500 ease-out hover:-translate-y-1 hover:scale-[1.03] motion-reduce:transition-none"
        style={{ aspectRatio: `${W} / ${H}`, perspective: '1800px', perspectiveOrigin: '50% 60%' }}
      >
        {/* base: the deck, never moves (overlaps the lid by a hair so no seam shows) */}
        <Image
          data-testid="laptop-base"
          src={src}
          alt={alt}
          width={W}
          height={H}
          className="absolute inset-0 h-full w-full max-w-none select-none"
          style={{ clipPath: `inset(${HINGE - 0.15}% 0 0 0)` }}
        />
        {/* lid: hinged on the deck's top edge */}
        <div
          data-testid="laptop-lid"
          className="absolute inset-0"
          style={{
            transformOrigin: `50% ${HINGE}%`,
            transform: open ? 'rotateX(0deg)' : `rotateX(${START_DEG}deg)`,
            transition: reduced ? 'none' : `transform ${OPEN_MS}ms cubic-bezier(0.45, 0.05, 0.25, 1)`,
            backfaceVisibility: 'hidden',
            willChange: 'transform',
          }}
        >
          <Image
            src={src}
            alt=""
            aria-hidden="true"
            width={W}
            height={H}
            className="absolute inset-0 h-full w-full max-w-none select-none"
            style={{ clipPath: `inset(0 0 ${100 - HINGE}% 0)` }}
          />
        </div>
      </div>
    </div>
  );
}
