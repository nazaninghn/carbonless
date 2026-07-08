'use client';

import { useLanguage } from '@/lib/i18n/LanguageContext';
import NextLink from 'next/link';
import Image from 'next/image';
import { Globe } from 'lucide-react';

export default function SimpleHeader() {
  const { language, changeLanguage, t } = useLanguage();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.04]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <NextLink href="/" className="flex items-center gap-3">
            <Image src="/carbonless.png" alt="Carbonless" width={56} height={56} className="h-11 w-11 sm:h-14 sm:w-14 object-contain" />
            <span className="text-xl sm:text-[22px] font-bold tracking-[-0.02em] text-[#302817]">
              Carbonless
            </span>
          </NextLink>
          
          {/* Language Toggle */}
          <button 
            onClick={() => changeLanguage(language === 'tr' ? 'en' : 'tr')} 
            className="flex items-center gap-2 rounded-full border border-[#302817]/15 bg-white px-4 py-2 text-sm font-semibold text-[#302817]/60 shadow-sm transition hover:border-[#51B291]/40 hover:text-[#244959]"
          >
            <Globe className="w-4 h-4" />
            {language === 'tr' ? 'EN' : 'TR'}
          </button>
        </div>
      </div>
    </header>
  );
}
