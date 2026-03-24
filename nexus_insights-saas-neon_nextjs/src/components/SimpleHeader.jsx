'use client';

import { useLanguage } from '@/lib/i18n/LanguageContext';
import NextLink from 'next/link';
import { Globe } from 'lucide-react';
import { Text } from '@/components/Text';

export default function SimpleHeader() {
  const { language, changeLanguage, t } = useLanguage();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <NextLink href="/" className="flex items-center gap-2">
            <img 
              src="/carbonless.png" 
              alt="Carbonless" 
              className="h-10 w-auto"
            />
            <Text variant="bold" className="text-xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              {t.brandName}
            </Text>
          </NextLink>
          
          {/* Language Toggle */}
          <button 
            onClick={() => changeLanguage(language === 'tr' ? 'en' : 'tr')} 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-sm font-medium text-gray-600"
          >
            <Globe className="w-4 h-4" />
            {language === 'tr' ? 'EN' : 'TR'}
          </button>
        </div>
      </div>
    </header>
  );
}
