'use client';

import { createContext, useContext, useState, useLayoutEffect } from 'react';
import { translations } from './translations';

// useLayoutEffect on client, useEffect on server (prevents SSR warning)
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : () => {};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en'); // SSR default — English

  // useLayoutEffect fires synchronously after DOM paint but BEFORE the browser
  // repaints — eliminates the flash of wrong language on client hydration.
  useIsomorphicLayoutEffect(() => {
    try {
      // Only use saved preference if user explicitly chose it (marked with '_explicit' flag).
      // Old code used to save 'tr' as default — we ignore those stale values.
      const saved = localStorage.getItem('language');
      const explicit = localStorage.getItem('language_explicit');
      if ((saved === 'tr' || saved === 'en') && explicit === '1') {
        setLanguage(saved);
      } else {
        // No explicit preference — default to English and persist it
        localStorage.setItem('language', 'en');
        localStorage.removeItem('language_explicit');
      }
    } catch {
      // localStorage blocked (private mode, etc.) — keep default
    }
  }, []);

  const changeLanguage = (lang) => {
    if (lang !== 'tr' && lang !== 'en') return;
    setLanguage(lang);
    try {
      localStorage.setItem('language', lang);
      localStorage.setItem('language_explicit', '1'); // marks that user actively chose this
    } catch {}
  };

  const t = translations[language] ?? translations['tr'];

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
