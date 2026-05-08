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
      const saved = localStorage.getItem('language');
      if (saved === 'tr' || saved === 'en') {
        setLanguage(saved);
      } else {
        // No saved preference — persist the default (English) so other pages read it
        localStorage.setItem('language', 'en');
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
