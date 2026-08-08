'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* Section anchors live on the homepage — from any other page these links
   land on "/" and jump to the section; from the homepage itself the browser
   just updates the hash in place (no reload, since the path is unchanged).
   `desktop: true` marks the curated subset shown in the horizontal pill nav
   (About/AI/Pricing/FAQ — the highest-intent links); the mobile dropdown has
   room to list all of them, Home included, since it's a vertical list. */
const NAV_ITEMS = [
  { key: 'home', hash: null, en: 'Home', tr: 'Ana Sayfa', desktop: false },
  { key: 'about', hash: 'about', en: 'About', tr: 'Hakkında', desktop: true },
  { key: 'ai', hash: 'ai', en: 'AI', tr: 'AI', desktop: true },
  { key: 'how-it-works', hash: 'how-it-works', en: 'How it Works', tr: 'Nasıl Çalışır?', desktop: false },
  { key: 'pricing', hash: 'pricing', en: 'Pricing', tr: 'Fiyatlandırma', desktop: true },
  { key: 'faq', hash: 'faq', en: 'FAQ', tr: 'FAQ', desktop: true },
];

/* Dinnect-style floating pill navbar — shared across every page so the
   header doesn't change identity when navigating from the homepage into
   /about, /features or /contact. */
export default function Header() {
  const { language: lang, changeLanguage } = useLanguage();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = e => { if (e.key === 'Escape') setMenuOpen(false); };
    const onDown = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [menuOpen]);

  const hrefFor = (hash) => (hash ? `/#${hash}` : '/');

  return (
    <header className="pointer-events-none sticky top-0 z-50 flex w-full justify-center px-3 pt-4">
      <nav ref={menuRef} className="pointer-events-auto relative flex h-14 max-w-full items-center gap-0.5 rounded-full border border-[#DEFAE1] bg-white/95 px-2 sm:px-3 shadow-[0_8px_30px_rgba(7,44,14,0.10)] backdrop-blur-md">
        {/* Logo */}
        <Link href="/" className="group flex shrink-0 items-center gap-2 rounded-full px-2 sm:px-3 py-1.5 transition-colors hover:bg-[#F1FCF2]">
          <Image src="/carbonless.png" alt="Carbonless" width={32} height={32} className="h-7 w-7 sm:h-8 sm:w-8 object-contain transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
          <span className="text-[15px] sm:text-[16px] font-bold tracking-tight text-[#072C0E]">Carbonless</span>
        </Link>

        {/* Hamburger — the curated desktop nav is short enough to show from md up */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          className="md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#072C0E]/60 transition-colors hover:bg-[#F1FCF2] hover:text-[#072C0E]"
        >
          {menuOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
        </button>

        {/* Divider */}
        <span className="hidden md:block mx-1 h-6 w-px bg-[#DEFAE1]" />

        {/* Nav links — curated subset; the full list still lives in the
            mobile dropdown below and in the footer, nothing is removed */}
        <div className="hidden md:flex items-center">
          {NAV_ITEMS.filter(item => item.desktop).map(item => (
            <a
              key={item.key}
              href={hrefFor(item.hash)}
              className="whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-medium text-[#072C0E]/55 transition-all duration-200 hover:bg-[#F1FCF2] hover:text-[#072C0E]"
            >
              {lang === 'tr' ? item.tr : item.en}
            </a>
          ))}
        </div>

        {/* Divider */}
        <span className="hidden sm:block mx-1 h-6 w-px bg-[#DEFAE1]" />

        {/* Lang + Log In + CTA */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <button
            onClick={() => changeLanguage(lang === 'tr' ? 'en' : 'tr')}
            aria-label={lang === 'tr' ? 'Switch to English' : 'Türkçeye geç'}
            className="rounded-full px-2 sm:px-2.5 py-1.5 text-[11px] sm:text-[12px] font-semibold text-[#072C0E]/50 uppercase transition-all duration-200 hover:bg-[#F1FCF2] hover:text-[#072C0E]"
          >
            {lang === 'tr' ? 'EN' : 'TR'}
          </button>
          <Link href="/login"
            className="hidden sm:block rounded-full px-3 py-1.5 text-[13px] font-medium text-[#072C0E]/60 transition-all duration-200 hover:bg-[#F1FCF2] hover:text-[#072C0E]">
            {lang === 'tr' ? 'Giriş Yap' : 'Log In'}
          </Link>
          <Link href="/register"
            className="ml-0.5 rounded-full bg-[#2ABD41] px-3.5 sm:px-5 py-2 text-[11px] sm:text-[13px] font-bold text-white shadow-sm transition-all duration-200 hover:bg-[#1D9C31] hover:shadow-lg hover:shadow-[#2ABD41]/30 hover:-translate-y-0.5 whitespace-nowrap">
            {lang === 'tr' ? 'Hesap Oluştur' : 'Create Account'}
          </Link>
        </div>

        {/* Mobile dropdown panel — hangs below the pill, never clipped
            (no overflow-hidden on the nav) */}
        {menuOpen && (
          <div className="md:hidden absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-[#DEFAE1] bg-white shadow-[0_16px_40px_rgba(7,44,14,0.14)]">
            {NAV_ITEMS.map(item => (
              <a key={item.key} href={hrefFor(item.hash)} onClick={() => setMenuOpen(false)}
                className="block px-5 py-3 text-[14px] font-medium text-[#072C0E]/70 transition-colors hover:bg-[#F1FCF2] hover:text-[#072C0E]">
                {lang === 'tr' ? item.tr : item.en}
              </a>
            ))}
            <a href="/login" onClick={() => setMenuOpen(false)}
              className="block px-5 py-3 text-[14px] font-medium text-[#072C0E]/70 transition-colors hover:bg-[#F1FCF2] hover:text-[#072C0E] border-t border-[#DEFAE1]">
              {lang === 'tr' ? 'Giriş Yap' : 'Log In'}
            </a>
          </div>
        )}
      </nav>
    </header>
  );
}
