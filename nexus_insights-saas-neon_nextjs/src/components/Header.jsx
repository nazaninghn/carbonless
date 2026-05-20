'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import NextLink from 'next/link';
import Image from 'next/image';
import { Globe } from 'lucide-react';
import { Menu } from 'lucide-react';
import { Text } from '@/components/Text';
import { X } from 'lucide-react';
import { Link } from '@/components/Link';

export default function Header() {
  const { language, changeLanguage, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.04]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <NextLink href="/" className="flex items-center gap-2">
            <Image src="/carbonless.png" alt="Carbonless" width={56} height={56} className="h-14 w-auto" />
            <Text variant="bold" className="text-xl font-bold text-[#16A34A]">
              {t.brandName}
            </Text>
          </NextLink>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            <NextLink href="/features" className="text-graphite hover:text-slate transition-colors duration-200 font-medium">
              {t.nav.features}
            </NextLink>
            <NextLink href="/about" className="text-graphite hover:text-slate transition-colors duration-200 font-medium">
              {t.nav.about}
            </NextLink>
            <NextLink href="/contact" className="text-graphite hover:text-slate transition-colors duration-200 font-medium">
              {t.nav.contact}
            </NextLink>
          </nav>
          
          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Language Toggle */}
            <button 
              onClick={() => changeLanguage(language === 'tr' ? 'en' : 'tr')} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-mist transition-colors duration-200 text-sm font-medium text-graphite"
            >
              <Globe className="w-4 h-4" />
              {language === 'tr' ? 'EN' : 'TR'}
            </button>
            <NextLink 
              href="/login" 
              className="text-graphite hover:text-slate transition-colors duration-200 font-medium"
            >
              {t.nav.login}
            </NextLink>
            <NextLink 
              href="/register" 
              className="relative group px-6 py-2.5 bg-gradient-to-r from-primary to-mint text-white font-semibold rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-glow"
            >
              <Text className="relative z-10">{t.nav.register}</Text>
              <div className="absolute inset-0 bg-gradient-to-r from-mint to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </NextLink>
          </div>
          
          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-2">
            {/* Language Toggle (Mobile) */}
            <button 
              onClick={() => changeLanguage(language === 'tr' ? 'en' : 'tr')} 
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-mist transition-colors duration-200 text-sm font-medium text-graphite"
            >
              <Globe className="w-4 h-4" />
              {language === 'tr' ? 'EN' : 'TR'}
            </button>
            <button 
              onClick={() => setMobileMenuOpen(true)} 
              aria-label="Open menu" 
              className="p-2 rounded-lg hover:bg-mist transition-colors duration-200"
            >
              <Menu className="w-6 h-6 text-graphite" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)} 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
        ></div>
      )}
      
      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-white z-50 lg:hidden h-[100vh]">
          <div className="flex flex-col h-full">
            {/* Mobile Menu Header */}
            <div className="flex items-center justify-between h-16 lg:h-20 px-6 border-b border-black/[0.04]">
              <NextLink href="/" className="flex items-center gap-2">
                <Image src="/carbonless.png" alt="Carbonless" width={56} height={56} className="h-14 w-auto" />
                <Text variant="bold" className="text-xl font-bold text-[#16A34A]">
                  {t.brandName}
                </Text>
              </NextLink>
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                aria-label="Close menu" 
                className="p-2 rounded-lg hover:bg-mist transition-colors duration-200"
              >
                <X className="w-6 h-6 text-graphite" />
              </button>
            </div>
            
            {/* Mobile Menu Links */}
            <nav className="flex-1 p-4 space-y-2">
              <NextLink 
                href="/features" 
                className="block px-4 py-3 text-graphite hover:bg-mist rounded-xl font-medium transition-colors duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t.nav.features}
              </NextLink>
              <NextLink 
                href="/about" 
                className="block px-4 py-3 text-graphite hover:bg-mist rounded-xl font-medium transition-colors duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t.nav.about}
              </NextLink>
              <NextLink 
                href="/contact" 
                className="block px-4 py-3 text-graphite hover:bg-mist rounded-xl font-medium transition-colors duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t.nav.contact}
              </NextLink>
            </nav>
            
            {/* Mobile Menu Footer */}
            <div className="p-4 border-t border-black/[0.04] space-y-3">
              <NextLink 
                href="/login" 
                className="block w-full px-6 py-3 text-center text-graphite border border-black/[0.08] rounded-xl font-semibold hover:bg-mist transition-colors duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t.nav.login}
              </NextLink>
              <NextLink 
                href="/register" 
                className="block w-full px-6 py-3 text-center bg-gradient-to-r from-primary to-mint text-white font-semibold rounded-xl hover:shadow-glow transition-all duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t.nav.register}
              </NextLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
