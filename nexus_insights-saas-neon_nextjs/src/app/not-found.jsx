'use client';

import { useState, useEffect } from 'react';
import NextLink from 'next/link';

export default function NotFound() {
  // not-found.jsx renders outside LanguageProvider (like error.jsx),
  // so we read language preference directly from localStorage.
  const [tr, setTr] = useState(false);

  useEffect(() => {
    try {
      const lang = localStorage.getItem('language');
      const explicit = localStorage.getItem('language_explicit');
      setTr(lang === 'tr' && explicit === '1');
    } catch {
      // localStorage blocked — keep English default
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9EFE5]/40 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-[#95A847] mb-4">404</h1>
        <h2 className="text-xl font-bold text-[#302817] mb-2">
          {tr ? 'Sayfa Bulunamadı' : 'Page Not Found'}
        </h2>
        <p className="text-[#302817]/60 mb-6 text-sm">
          {tr
            ? 'Aradığınız sayfa mevcut değil veya taşınmış olabilir.'
            : 'The page you are looking for does not exist or may have moved.'}
        </p>
        <NextLink
          href="/"
          className="px-6 py-3 bg-[#302817] text-[#F9EFE5] rounded-xl hover:bg-black transition-colors inline-block font-semibold"
        >
          {tr ? 'Ana Sayfaya Dön' : 'Back to Home'}
        </NextLink>
      </div>
    </div>
  );
}
