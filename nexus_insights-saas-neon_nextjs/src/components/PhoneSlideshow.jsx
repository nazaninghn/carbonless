'use client';

import { useEffect, useRef, useState } from 'react';

/* -- Phone slideshow (About section) --
   The four phone pictures in public/ each show the same phone, so the frame never changes: the next picture is
   faded in ON TOP of the current one (which stays fully opaque underneath), so only the screen content appears to
   change and the frame stays put. The box has a fixed size, so nothing shifts.

   Plays by itself, one picture every SLIDE_MS, looping. It stops while the phone is scrolled out of view or the tab
   is hidden, and with prefers-reduced-motion it does not advance on its own (the dots still switch pictures, instantly).
   The picture that comes next is only chosen once it has loaded, so a slow connection never fades to a blank. */
const SLIDE_MS = 3600;
const FADE_MS = 900;

export default function PhoneSlideshow({ images, label, dotLabel, className = '' }) {
  const rootRef = useRef(null);
  const imgRefs = useRef([]);
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState(-1);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return undefined; }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setTabVisible(document.visibilityState !== 'hidden');
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const show = next => {
    if (next === index) return;
    setPrev(index);
    setIndex(next);
  };

  const playing = inView && tabVisible && !reduced && images.length > 1;
  useEffect(() => {
    if (!playing) return undefined;
    let timer;
    // advance to the next picture that has loaded; if none has yet, look again shortly (never stall on a slow load)
    const advance = () => {
      for (let step = 1; step < images.length; step++) {
        const next = (index + step) % images.length;
        const el = imgRefs.current[next];
        if (el && el.complete && el.naturalWidth > 0) { setPrev(index); setIndex(next); return; }
      }
      timer = setTimeout(advance, 400);
    };
    timer = setTimeout(advance, SLIDE_MS);
    return () => clearTimeout(timer);
  }, [playing, index, images.length]);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      data-testid="phone-slideshow"
      data-playing={playing ? 'true' : 'false'}
      className={`relative ${className}`}
    >
      {images.map((src, i) => {
        const active = i === index, leaving = i === prev;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            ref={el => { imgRefs.current[i] = el; }}
            src={src}
            alt=""
            data-testid="phone-slide"
            data-active={active ? 'true' : 'false'}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover object-top motion-reduce:transition-none"
            style={{
              opacity: active || leaving ? 1 : 0,
              zIndex: active ? 2 : leaving ? 1 : 0,
              // the arriving picture fades in over the one that is leaving; the leaving one is simply covered
              transition: active && !reduced ? `opacity ${FADE_MS}ms ease-in-out` : 'none',
            }}
          />
        );
      })}

      {/* optional controls: the slideshow runs without them */}
      <div className="absolute inset-x-0 bottom-[7.2%] z-10 flex justify-center">
        <div className="flex items-center rounded-full bg-white/70 px-1 backdrop-blur-sm">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              data-testid="phone-dot"
              aria-label={dotLabel(i + 1, images.length)}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => show(i)}
              className="group flex h-6 w-5 items-center justify-center"
            >
              <span className={`block rounded-full transition-all duration-300 motion-reduce:transition-none ${i === index ? 'h-1.5 w-3.5 bg-[#1A7B2A]' : 'h-1.5 w-1.5 bg-[#1A7B2A]/35 group-hover:bg-[#1A7B2A]/60'}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
