'use client';

import { useState, useEffect } from 'react';

export default function Error({ error, reset }) {
  // error.jsx renders outside LanguageProvider (it can catch layout-level errors),
  // so we read the language preference directly from localStorage.
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
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-[#072C0E] mb-2">
          {tr ? 'Bir hata oluştu' : 'Something went wrong'}
        </h2>
        <p className="text-[#072C0E]/60 mb-6 text-sm">
          {error?.message || (tr
            ? 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'
            : 'An unexpected error occurred. Please try again.')}
        </p>
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-[#1D9C31] text-[#DEFAE1] rounded-xl hover:bg-[#1A7B2A] transition-colors font-semibold"
        >
          {tr ? 'Tekrar Dene' : 'Try Again'}
        </button>
      </div>
    </div>
  );
}
