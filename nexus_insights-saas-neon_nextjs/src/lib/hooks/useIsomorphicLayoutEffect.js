import { useLayoutEffect, useEffect } from 'react';

/**
 * useLayoutEffect on the client (fires synchronously before browser repaint),
 * useEffect on the server (avoids Next.js SSR hydration warnings).
 *
 * Use this whenever you need layout-synchronous side effects that must not
 * flash a wrong state for even one frame (e.g. Android-detection, language init).
 */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default useIsomorphicLayoutEffect;
