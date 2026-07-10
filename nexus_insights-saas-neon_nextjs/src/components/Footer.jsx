'use client';

import NextLink from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function Footer() {
  const { language } = useLanguage();
  const tr = language === 'tr';
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#175022] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

          {/* Brand */}
          <div>
            <NextLink href="/" className="inline-flex items-center gap-2 mb-4">
              <Image src="/carbonless.png" alt="Carbonless" width={40} height={40} className="h-10 w-10" />
              <span className="text-lg font-bold text-white">Carbonless</span>
            </NextLink>
            <p className="text-sm text-white/55 leading-relaxed max-w-xs">
              {tr
                ? 'ISO 14064-1 uyumlu karbon envanteri yönetimi için SaaS platformu.'
                : 'SaaS platform for ISO 14064-1 compliant carbon inventory management.'}
            </p>
          </div>

          {/* Navigation */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/35 mb-4">
              {tr ? 'Sayfalar' : 'Pages'}
            </p>
            <nav className="flex flex-col gap-2.5">
              {[
                { href: '/features', label: tr ? 'Özellikler' : 'Features' },
                { href: '/about',    label: tr ? 'Hakkımızda' : 'About' },
                { href: '/contact',  label: tr ? 'İletişim'   : 'Contact' },
                { href: '/login',    label: tr ? 'Giriş'      : 'Login' },
                { href: '/register', label: tr ? 'Kayıt Ol'   : 'Register' },
              ].map(({ href, label }) => (
                <NextLink
                  key={href}
                  href={href}
                  className="text-sm text-white/60 hover:text-white transition-colors duration-200"
                >
                  {label}
                </NextLink>
              ))}
            </nav>
          </div>

          {/* Standards */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/35 mb-4">
              {tr ? 'Standartlar' : 'Standards'}
            </p>
            <ul className="flex flex-col gap-2">
              {['ISO 14064-1:2018', 'GHG Protocol', 'Defra/DESNZ 2024', 'IPCC 2019 + AR6'].map((s) => (
                <li key={s} className="text-sm text-white/55">{s}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/35">
            © {year} Carbonless.{' '}
            {tr ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}
          </p>
          <p className="text-xs text-white/25">
            {tr
              ? 'İstinye Üniversitesi IT Valley bünyesinde geliştirilmiştir.'
              : 'Developed at İstinye University IT Valley.'}
          </p>
        </div>
      </div>
    </footer>
  );
}
