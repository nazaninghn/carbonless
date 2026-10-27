import { useEffect, useState } from 'react';

/* Decides whether the hero's ambient motion should run.
     'reduced' — the user prefers reduced motion (tracked live, not just on load)
     'paused'  — the hero is scrolled out of view or the tab is hidden
     'on'      — otherwise
   It only drives a data attribute; the animations themselves are CSS (hero.css),
   which also honours prefers-reduced-motion on its own so the first paint is
   already correct. Defaults to 'on' on the server and first render. */
export default function useHeroMotion(ref) {
  const [reduced, setReduced] = useState(false);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update); // older Safari
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  useEffect(() => {
    const onVis = () => setTabVisible(document.visibilityState !== 'hidden');
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (reduced) return 'reduced';
  return inView && tabVisible ? 'on' : 'paused';
}
