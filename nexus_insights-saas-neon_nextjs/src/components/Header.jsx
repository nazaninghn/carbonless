'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import NextLink from 'next/link';
import { Globe } from 'lucide-react';
import { Menu } from 'lucide-react';
import { Text } from '@/components/Text';
import { X } from 'lucide-react';
import { Link } from '@/components/Link';

export default function Header() {
  const { language, changeLanguage, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
            <NextLink href="/features" className="text-gray-600 hover:text-primary transition-colors duration-200 font-medium">
              {t.nav.features}
            </NextLink>
            <NextLink href="/about" className="text-gray-600 hover:text-primary transition-colors duration-200 font-medium">
              {t.nav.about}
            </NextLink>
            <NextLink href="/contact" className="text-gray-600 hover:text-primary transition-colors duration-200 font-medium">
              {t.nav.contact}
            </NextLink>
          </nav>
          
          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Language Toggle */}
            <button 
              onClick={() => changeLanguage(language === 'tr' ? 'en' : 'tr')} 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-sm font-medium text-gray-600"
            >
              <Globe className="w-4 h-4" />
              {language === 'tr' ? 'EN' : 'TR'}
            </button>
            <NextLink 
              href="/login" 
              className="text-gray-600 hover:text-primary transition-colors duration-200 font-medium"
            >
              {t.nav.login}
            </NextLink>
            <NextLink 
              href="/register" 
              className="relative group px-6 py-2.5 bg-gradient-to-r from-primary via-secondary to-accent text-white font-semibold rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/25"
            >
              <Text className="relative z-10">{t.nav.register}</Text>
              <div className="absolute inset-0 bg-gradient-to-r from-accent via-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </NextLink>
          </div>
          
          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-2">
            {/* Language Toggle (Mobile) */}
            <button 
              onClick={() => changeLanguage(language === 'tr' ? 'en' : 'tr')} 
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-sm font-medium text-gray-600"
            >
              <Globe className="w-4 h-4" />
              {language === 'tr' ? 'EN' : 'TR'}
            </button>
            <button 
              onClick={() => setMobileMenuOpen(true)} 
              aria-label="Open menu" 
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)} 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
        ></div>
      )}
      
      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-white z-50 lg:hidden h-[100vh]">
          <div className="flex flex-col h-full">
            {/* Mobile Menu Header */}
            <div className="flex items-center justify-between h-16 lg:h-20 px-6 border-b border-gray-200">
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
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                aria-label="Close menu" 
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>
            
            {/* Mobile Menu Links */}
            <nav className="flex-1 p-4 space-y-2">
              <NextLink 
                href="/features" 
                className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t.nav.features}
              </NextLink>
              <NextLink 
                href="/about" 
                className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t.nav.about}
              </NextLink>
              <NextLink 
                href="/contact" 
                className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition-colors duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t.nav.contact}
              </NextLink>
            </nav>
            
            {/* Mobile Menu Footer */}
            <div className="p-4 border-t border-gray-200 space-y-3">
              <NextLink 
                href="/login" 
                className="block w-full px-6 py-3 text-center text-gray-700 border border-gray-200 rounded-xl font-semibold hover:bg-gray-50 transition-colors duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                {t.nav.login}
              </NextLink>
              <NextLink 
                href="/register" 
                className="block w-full px-6 py-3 text-center bg-gradient-to-r from-primary via-secondary to-accent text-white font-semibold rounded-xl hover:opacity-90 transition-opacity duration-200"
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
