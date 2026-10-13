'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// The browser tab named every page "Carbonless — AI-Powered Carbon
// Calculator Platform" in English, whatever the page and its language. This
// names the tab after the page, in the page's language, and sets <html lang>
// to match so screen readers read Turkish text as Turkish.
const TITLES = {
  '/':                { tr: 'Carbonless — Karbon Ayak İzi Hesaplama', en: 'Carbonless — AI-Powered Carbon Calculator' },
  '/login':           { tr: 'Giriş Yap', en: 'Sign In' },
  '/register':        { tr: 'Şirket Kaydı', en: 'Company Registration' },
  '/forgot-password': { tr: 'Şifremi Unuttum', en: 'Forgot Password' },
  '/reset-password':  { tr: 'Yeni Şifre', en: 'New Password' },
  '/verify-email':    { tr: 'E-posta Doğrulama', en: 'Email Verification' },
  '/join':            { tr: 'Ekibe Katıl', en: 'Join Your Team' },
  '/accept-invite':   { tr: 'Daveti Kabul Et', en: 'Accept Invitation' },
  '/contact':         { tr: 'İletişim', en: 'Contact' },
  '/about':           { tr: 'Hakkımızda', en: 'About' },
  '/features':        { tr: 'Özellikler', en: 'Features' },
  '/ai':              { tr: 'Carbonless AI', en: 'Carbonless AI' },
  '/privacy':         { tr: 'Gizlilik Politikası', en: 'Privacy Policy' },
  '/terms':           { tr: 'Kullanım Koşulları', en: 'Terms of Use' },
  '/dashboard':       { tr: 'Kontrol Paneli', en: 'Dashboard' },
  '/dashboard/workspace': { tr: 'Karbon Envanteri', en: 'Carbon Inventory' },
};
const NOT_FOUND = { tr: 'Sayfa Bulunamadı', en: 'Page Not Found' };

export default function PageTitle() {
  const pathname = usePathname() || '/';
  const { language } = useLanguage();
  useEffect(() => {
    const lang = language === 'tr' ? 'tr' : 'en';
    const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
    const t = TITLES[path] || (path.startsWith('/dashboard') ? TITLES['/dashboard'] : NOT_FOUND);
    const title = path === '/' ? t[lang] : `${t[lang]} · Carbonless`;
    document.documentElement.lang = lang;
    // Next writes the layout's metadata title after this runs (and again on
    // navigation), so keep putting the page's own title back.
    const apply = () => { if (document.title !== title) document.title = title; };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, [pathname, language]);
  return null;
}
