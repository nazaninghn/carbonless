'use client';

import { useEffect, useRef, useState } from 'react';
import './reveal.css';

/* -- Scroll reveal: fades a block in while it rises ~16px, once, when it first enters the viewport --
   Used on the About and Carbonless AI pages. The IntersectionObserver disconnects after the first reveal, so scrolling up and
   down never replays it. `delay` (ms) staggers neighbouring blocks. Without IntersectionObserver the block is shown at once;
   with prefers-reduced-motion (reveal.css) it is never hidden or moved. */

export default function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return undefined; }
    const io = new IntersectionObserver((entries) => {
      // (a block already scrolled past counts too: it is never left hidden)
      if (entries.some((e) => e.isIntersecting || e.boundingClientRect.top < 0)) { setShown(true); io.disconnect(); }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal={shown ? 'in' : 'out'}
      className={`rv ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
