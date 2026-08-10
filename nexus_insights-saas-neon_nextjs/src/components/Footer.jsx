'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Linkedin } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Shared across every page — glass card over a soft green "halo", the same
   visual language as the homepage hero/header. Product links use `/#hash`
   (not bare `#hash`) so they resolve correctly from any page, not just "/". */
export default function Footer() {
  const { language: lang } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 overflow-hidden bg-gradient-to-b from-[#F1FCF2] to-white py-10 sm:py-16">
      {/* Green "halo" blobs — this is what the glass card actually blurs.
          Without something behind it, backdrop-blur has nothing to do. */}
      <div className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[#2ABD41]/25 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-[#8BEA99]/35 blur-[100px]" />

      {/* Faded brand leaf-branch watermark — sits behind the glass so it
          reads as part of the same soft scene. */}
      <img
        src="/hero-corner2.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -top-6 right-0 z-0 w-[260px] select-none opacity-[0.3] sm:w-[380px]"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-8">
        {/* Glass card — everything below lives inside it */}
        <div className="rounded-[28px] border border-white/70 bg-white/40 backdrop-blur-2xl shadow-[0_20px_60px_rgba(7,44,14,0.10)] px-5 sm:px-10 pt-10 sm:pt-14 pb-6 sm:pb-8">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-5 md:gap-8">

            {/* Brand + tagline + socials */}
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2.5">
                <Image src="/carbonless.png" alt="Carbonless" width={32} height={32} className="h-8 w-8 object-contain" />
                <span className="text-[20px] font-extrabold tracking-tight text-[#072C0E]">Carbonless</span>
              </Link>
              <p className="mt-5 max-w-xs text-[13px] sm:text-[14px] leading-[1.8] text-[#072C0E]/60">
                {lang === 'tr'
                  ? 'Karbon ayak izinizi AI ile hesaplayın, ISO 14064-1 uyumlu raporlar oluşturun. Karbon muhasebesi, yeniden tasarlandı.'
                  : 'Calculate your carbon footprint with AI and generate ISO 14064-1 compliant reports. Carbon accounting, reimagined.'}
              </p>
              <div className="mt-6 flex gap-3">
                <a href="https://www.linkedin.com/company/carbonless-network" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 border border-white/80 text-[#072C0E]/60 shadow-sm transition hover:bg-[#2ABD41] hover:border-[#2ABD41] hover:text-white">
                  <Linkedin className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#072C0E]/40">
                {lang === 'tr' ? 'Ürün' : 'Product'}
              </h4>
              <ul className="mt-5 space-y-3.5 text-[13px] sm:text-[14px]">
                <li><Link href="/ai" className="text-[#072C0E]/70 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Carbonless AI' : 'Carbonless AI'}</Link></li>
                <li><a href="/#pricing" className="text-[#072C0E]/70 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Fiyatlandırma' : 'Pricing'}</a></li>
                <li><a href="/#faq" className="text-[#072C0E]/70 transition hover:text-[#2ABD41]">FAQ</a></li>
                <li><Link href="/register" className="text-[#072C0E]/70 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Ücretsiz Başlayın' : 'Get Started Free'}</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#072C0E]/40">
                {lang === 'tr' ? 'Şirket' : 'Company'}
              </h4>
              <ul className="mt-5 space-y-3.5 text-[13px] sm:text-[14px]">
                <li><Link href="/about" className="text-[#072C0E]/70 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Hakkımızda' : 'About Us'}</Link></li>
                <li><Link href="/contact" className="text-[#072C0E]/70 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'İletişim' : 'Contact'}</Link></li>
                <li><Link href="/login" className="text-[#072C0E]/70 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Giriş' : 'Login'}</Link></li>
                <li><Link href="/register" className="text-[#072C0E]/70 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Hesap Oluştur' : 'Create Account'}</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#072C0E]/40">
                {lang === 'tr' ? 'Yasal' : 'Legal'}
              </h4>
              <ul className="mt-5 space-y-3.5 text-[13px] sm:text-[14px]">
                <li><Link href="/privacy" className="text-[#072C0E]/70 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}</Link></li>
                <li><Link href="/terms" className="text-[#072C0E]/70 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Kullanım Koşulları' : 'Terms of Service'}</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 sm:mt-16 flex flex-col items-center justify-between gap-3 border-t border-[#072C0E]/10 pt-5 sm:pt-6 sm:flex-row">
            <span className="text-[11px] sm:text-[12px] text-[#072C0E]/40">
              &copy; {year} Carbonless. {lang === 'tr' ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}
            </span>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-[11px] sm:text-[12px] text-[#072C0E]/40 transition hover:text-[#072C0E]/80">
                {lang === 'tr' ? 'Gizlilik' : 'Privacy Policy'}
              </Link>
              <Link href="/terms" className="text-[11px] sm:text-[12px] text-[#072C0E]/40 transition hover:text-[#072C0E]/80">
                {lang === 'tr' ? 'Kullanım Koşulları' : 'Terms of Service'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
