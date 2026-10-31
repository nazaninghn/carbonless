'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import './eco.css';

/* -- A transparent picture that fades in once and then floats gently (used by EcoVisual: eco.png, and the Our Mission picture) --
   The picture is drawn in a box that starts cropLeft px into the canvas (an empty margin is cropped away: nothing visible is
   lost); the box has a fixed aspect ratio, so nothing shifts while it loads. A soft CSS mask fades the edges where the art is cut
   off by its canvas (maskClass). Motion (eco.css, .eco-*): when it first scrolls into view it fades in and rises ~22px, once per
   page load; afterwards it floats a few pixels with a barely-there scale, and a soft green glow behind it breathes. The ambient
   motion pauses while the section is out of view or the tab is hidden, and with prefers-reduced-motion the picture is simply
   shown in its final place. */

export default function ArtVisual({ src, natW, natH, cropLeft = 0, alt, testId = 'eco', maskClass = '', sizes = '(min-width: 1024px) 620px, 92vw', className = '' }) {
  const BOX_W = natW - cropLeft;
  const BOX_H = natH;
  const ref = useRef(null);
  const imgRef = useRef(null);
  const [entered, setEntered] = useState(false);   // first time it is (mostly) in view
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setEntered(true); setInView(true); return undefined; }
    const io = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (entry.isIntersecting && entry.intersectionRatio >= 0.2) setEntered(true);      // (never reset: it plays once)
    }, { threshold: [0, 0.2] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setTabVisible(document.visibilityState !== 'hidden');
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => { if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setLoaded(true); }, []);

  const shown = reduced || (entered && loaded);
  const ambient = !reduced && shown && inView && tabVisible;

  return (
    <div
      ref={ref}
      data-testid={testId}
      data-shown={shown ? 'true' : 'false'}
      data-ambient={ambient ? 'running' : 'paused'}
      className={`eco ${className}`}
      style={{ aspectRatio: `${BOX_W} / ${BOX_H}` }}
    >
      <div aria-hidden="true" className="eco-glow" />
      <div className="eco-in" data-shown={shown ? 'true' : 'false'}>
        <div className="eco-float" data-testid="eco-float">
          <div className={`eco-mask ${maskClass}`}>
            <Image
              ref={imgRef}
              data-testid={`${testId}-img`}
              src={src}
              alt={alt}
              width={natW}
              height={natH}
              sizes={sizes}
              onLoad={() => setLoaded(true)}
              className="eco-img select-none"
              style={{ width: `${(natW / BOX_W) * 100}%`, left: `${-(cropLeft / BOX_W) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
