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
    <div className="min-h-screen flex items-center justify-center bg-[#DEFAE1]/40 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-[#2ABD41] mb-4">404</h1>
        <h2 className="text-xl font-bold text-[#072C0E] mb-2">
          {tr ? 'Sayfa Bulunamadı' : 'Page Not Found'}
        </h2>
        <p className="text-[#072C0E]/60 mb-6 text-sm">
          {tr
            ? 'Aradığınız sayfa mevcut değil veya taşınmış olabilir.'
            : 'The page you are looking for does not exist or may have moved.'}
        </p>
        <NextLink
          href="/"
          className="px-6 py-3 bg-[#1D9C31] text-[#DEFAE1] rounded-xl hover:bg-[#1A7B2A] transition-colors inline-block font-semibold"
        >
          {tr ? 'Ana Sayfaya Dön' : 'Back to Home'}
        </NextLink>
      </div>
    </div>
  );
}
