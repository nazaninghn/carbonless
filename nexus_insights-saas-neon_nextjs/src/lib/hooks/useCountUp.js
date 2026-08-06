import { useState, useEffect } from 'react';

/**
 * Animates a number from 0 to `target` on mount / whenever `target` changes
 * (e.g. switching the selected year) — used to make KPI/summary numbers feel
 * "alive" instead of just snapping to their final value.
 *
 * Respects prefers-reduced-motion: users who've asked for less motion get the
 * final value immediately, no animation.
 */
export default function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) { setValue(target); return; }
    let raf;
    const startTime = performance.now();
    const from = 0;
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(from + (target - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
