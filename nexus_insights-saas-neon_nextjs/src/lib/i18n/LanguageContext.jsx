'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { translations } from './translations';
import useIsomorphicLayoutEffect from '@/lib/hooks/useIsomorphicLayoutEffect';
import { setNumberLanguage } from '@/lib/formatNumber';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en'); // SSR default — English
  // Set before the children render, so their numbers use this language.
  setNumberLanguage(language);

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
        // No explicit preference — follow the browser: Turkish browsers get
        // Turkish, everyone else English. Not marked explicit, so a later
        // browser change is still followed until the user picks a language.
        const langs = (navigator.languages && navigator.languages.length)
          ? navigator.languages : [navigator.language || ''];
        const detected = langs.some(l => String(l).toLowerCase().startsWith('tr')) ? 'tr' : 'en';
        setLanguage(detected);
        localStorage.setItem('language', detected);
        localStorage.removeItem('language_explicit');
      }
    } catch {
      // localStorage blocked (private mode, etc.) — keep default
    }
  }, []);

  // Fix 24: Keep html[lang] in sync with current language for screen readers.
  // layout.jsx has lang="en" hardcoded (server render) — this effect updates it
  // client-side on mount and on every language switch, satisfying WCAG 3.1.1 (Level A).
  useIsomorphicLayoutEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = useCallback((lang) => {
    if (lang !== 'tr' && lang !== 'en') return;
    setLanguage(lang);
    try {
      localStorage.setItem('language', lang);
      localStorage.setItem('language_explicit', '1'); // marks that user actively chose this
    } catch {}
    // A signed-in user's choice is also the account's language, which the
    // notifications (and e-mails) are written in — not only this browser's.
    try {
      if (typeof document !== 'undefined' && document.cookie.includes('carbonless_auth=1')) {
        import('@/lib/utils/api')
          .then(({ api }) => api.updateProfile({ language_preference: lang }))
          .catch(() => {});
      }
    } catch {}
  }, []);

  // `translations` is a module-level import — same reference for the lifetime of the page.
  // `t` only changes when `language` changes, so this lookup is already stable.
  // Fallback to 'en' — the app's default language (not 'tr', which was the old default).
  const t = translations[language] ?? translations['en'];

  // Memoize context value so every useLanguage() consumer isn't forced to re-render
  // on unrelated LanguageProvider re-renders (e.g. during initial layout effects).
  const contextValue = useMemo(
    () => ({ language, changeLanguage, t }),
    [language, changeLanguage, t],
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
