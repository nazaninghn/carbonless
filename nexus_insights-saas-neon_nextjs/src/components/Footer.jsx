'use client';

import { useLanguage } from '@/lib/i18n/LanguageContext';
import NextLink from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img 
                src="/carbonless.png" 
                alt="Carbonless" 
                className="h-10 w-auto"
              />
              <h3 className="text-xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                {t.company.name}
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              {t.footer.description}
            </p>
            
            {/* Contact Info */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                <p className="text-sm text-gray-600">{t.company.address}</p>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-primary flex-shrink-0" />
                <a href={`tel:${t.company.phone}`} className="text-sm text-gray-600 hover:text-primary">
                  {t.company.phone}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary flex-shrink-0" />
                <a href={`mailto:${t.company.email}`} className="text-sm text-gray-600 hover:text-primary">
                  {t.company.email}
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">{t.footer.quickLinks}</h4>
            <ul className="space-y-2">
              <li>
                <NextLink href="/features" className="text-gray-600 hover:text-primary transition-colors text-sm">
                  {t.nav.features}
                </NextLink>
              </li>
              <li>
                <NextLink href="/about" className="text-gray-600 hover:text-primary transition-colors text-sm">
                  {t.nav.about}
                </NextLink>
              </li>
              <li>
                <NextLink href="/contact" className="text-gray-600 hover:text-primary transition-colors text-sm">
                  {t.nav.contact}
                </NextLink>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">{t.footer.legal}</h4>
            <ul className="space-y-2">
              <li>
                <NextLink href="/privacy" className="text-gray-600 hover:text-primary transition-colors text-sm">
                  {t.footer.privacy}
                </NextLink>
              </li>
              <li>
                <NextLink href="/terms" className="text-gray-600 hover:text-primary transition-colors text-sm">
                  {t.footer.terms}
                </NextLink>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">{t.footer.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
