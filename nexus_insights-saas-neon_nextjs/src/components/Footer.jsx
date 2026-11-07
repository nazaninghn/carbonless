'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Linkedin } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Shared across every page. Plain white like the rest of the site: no gradient, no tinted panel, no coloured blobs;
   the card is white with a hairline border and a soft shadow. Product links use `/#hash` (not bare `#hash`) so they
   resolve correctly from any page, not just "/". Text colours are the dark brand green at 65-70% or more, which is
   at least 4.5:1 on white (the old 40-60% values were written for a tinted surface and read too faint on white). */
export default function Footer() {
  const { language: lang } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 overflow-x-clip bg-white py-10 sm:py-14">
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8">
        {/* Card — everything below lives inside it */}
        <div className="rounded-[28px] border border-[#072C0E]/10 bg-white shadow-[0_20px_60px_rgba(7,44,14,0.08)] px-5 sm:px-10 pt-10 sm:pt-14 pb-6 sm:pb-8">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-5 md:gap-8">

            {/* Brand + tagline + socials */}
            <div className="col-span-2">
              <Link href="/" className="flex min-h-11 items-center gap-2.5">
                <Image src="/carbonless.png" alt="Carbonless" width={32} height={32} className="h-8 w-8 object-contain" />
                <span className="text-[18px] font-extrabold tracking-tight text-[#072C0E]">Carbonless</span>
              </Link>
              <p className="mt-5 max-w-xs text-[13px] sm:text-[14px] leading-[1.8] text-[#072C0E]/70">
                {lang === 'tr'
                  ? 'Karbon ayak izinizi AI ile hesaplayın, ISO 14064-1 uyumlu raporlar oluşturun. Karbon muhasebesi, yeniden tasarlandı.'
                  : 'Calculate your carbon footprint with AI and generate ISO 14064-1 compliant reports. Carbon accounting, reimagined.'}
              </p>
              <div className="mt-6 flex gap-3">
                <a href="https://www.linkedin.com/company/carbonless-network" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"
                  className="flex h-10 w-10 items-center justify-center rounded-full btn-glass max-lg:h-11 max-lg:w-11">
                  <Linkedin className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#072C0E]/65">
                {lang === 'tr' ? 'Ürün' : 'Product'}
              </h4>
              <ul className="mt-5 space-y-3.5 text-[13px] max-lg:mt-2 max-lg:space-y-0 sm:text-[14px]">
                <li><Link href="/features" className="text-[#072C0E]/70 transition hover:text-[#2ABD41] max-lg:flex max-lg:min-h-11 max-lg:items-center">{lang === 'tr' ? 'Özellikler' : 'Features'}</Link></li>
                <li><Link href="/ai" className="text-[#072C0E]/70 transition hover:text-[#2ABD41] max-lg:flex max-lg:min-h-11 max-lg:items-center">Carbonless AI</Link></li>
                <li><Link href="/#pricing" className="text-[#072C0E]/70 transition hover:text-[#2ABD41] max-lg:flex max-lg:min-h-11 max-lg:items-center">{lang === 'tr' ? 'Fiyatlandırma' : 'Pricing'}</Link></li>
                <li><Link href="/#faq" className="text-[#072C0E]/70 transition hover:text-[#2ABD41] max-lg:flex max-lg:min-h-11 max-lg:items-center">{lang === 'tr' ? 'Sıkça Sorulan Sorular' : 'FAQ'}</Link></li>
                <li><Link href="/register" className="text-[#072C0E]/70 transition hover:text-[#2ABD41] max-lg:flex max-lg:min-h-11 max-lg:items-center">{lang === 'tr' ? 'Ücretsiz Başlayın' : 'Get Started Free'}</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#072C0E]/65">
                {lang === 'tr' ? 'Şirket' : 'Company'}
              </h4>
              <ul className="mt-5 space-y-3.5 text-[13px] max-lg:mt-2 max-lg:space-y-0 sm:text-[14px]">
                <li><Link href="/about" className="text-[#072C0E]/70 transition hover:text-[#2ABD41] max-lg:flex max-lg:min-h-11 max-lg:items-center">{lang === 'tr' ? 'Hakkımızda' : 'About Us'}</Link></li>
                <li><Link href="/contact" className="text-[#072C0E]/70 transition hover:text-[#2ABD41] max-lg:flex max-lg:min-h-11 max-lg:items-center">{lang === 'tr' ? 'İletişim' : 'Contact'}</Link></li>
                <li><Link href="/login" className="text-[#072C0E]/70 transition hover:text-[#2ABD41] max-lg:flex max-lg:min-h-11 max-lg:items-center">{lang === 'tr' ? 'Giriş' : 'Login'}</Link></li>
                <li><Link href="/register" className="text-[#072C0E]/70 transition hover:text-[#2ABD41] max-lg:flex max-lg:min-h-11 max-lg:items-center">{lang === 'tr' ? 'Hesap Oluştur' : 'Create Account'}</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#072C0E]/65">
                {lang === 'tr' ? 'Yasal' : 'Legal'}
              </h4>
              <ul className="mt-5 space-y-3.5 text-[13px] max-lg:mt-2 max-lg:space-y-0 sm:text-[14px]">
                <li><Link href="/privacy" className="text-[#072C0E]/70 transition hover:text-[#2ABD41] max-lg:flex max-lg:min-h-11 max-lg:items-center">{lang === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}</Link></li>
                <li><Link href="/terms" className="text-[#072C0E]/70 transition hover:text-[#2ABD41] max-lg:flex max-lg:min-h-11 max-lg:items-center">{lang === 'tr' ? 'Kullanım Koşulları' : 'Terms of Service'}</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 sm:mt-16 flex flex-col items-center justify-between gap-3 border-t border-[#072C0E]/10 pt-5 sm:pt-6 sm:flex-row">
            <span className="text-[11px] sm:text-[12px] text-[#072C0E]/65">
              &copy; {year} Carbonless. {lang === 'tr' ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
