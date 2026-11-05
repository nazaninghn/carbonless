'use client';

import { useState } from 'react';
import Image from 'next/image';
import { BarChart3, Brain, ArrowRight, Sparkles, Leaf, Activity, Globe2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const texts = {
  en: {
    title: 'How would you like to work today?',
    subtitle: 'Both methods save to the same database. You can switch anytime.',
    recommended: 'Recommended',
    aiTitle: 'AI Calculator',
    aiDesc: 'Fill in your Carbon Inventory step by step with the AI assistant beside you: it answers questions, calculates, and the full ISO 14064-1 report comes out at the end.',
    aiF1: 'Carbon Inventory (ISO 14064-1)',
    aiF2: 'AI assistant: answers and calculations',
    aiF3: 'Full report at the end',
    aiBtn: 'Start with AI',
    dashTitle: 'Dashboard',
    dashDesc: 'Enter data manually from forms, view charts and reports.',
    dashF1: 'Detailed emission management',
    dashF2: 'Charts and analytics',
    dashF3: 'Reduction targets',
    dashBtn: 'Go to Dashboard',
    note: 'Both modes write to the same database  -  you can switch anytime.',
    logout: 'Sign in with different account',
  },
  tr: {
    title: 'Bugün nasıl çalışmak istersiniz?',
    subtitle: 'Her iki yol da aynı veritabanına kaydeder. İstediğiniz zaman geçiş yapabilirsiniz.',
    recommended: 'Önerilen',
    aiTitle: 'AI Hesaplayıcı',
    aiDesc: 'Karbon envanterinizi adım adım doldurun; yanınızdaki AI asistan sorularınızı yanıtlar, hesaplar ve sonunda tam ISO 14064-1 raporunuz hazır olur.',
    aiF1: 'Karbon Envanteri (ISO 14064-1)',
    aiF2: 'AI asistan: soru-cevap ve hesaplama',
    aiF3: 'Sonunda tam rapor',
    aiBtn: 'AI ile başla',
    dashTitle: 'Kontrol Paneli',
    dashDesc: 'Formlardan manuel veri girin, grafikler ve raporları görüntüleyin.',
    dashF1: 'Detaylı emisyon yönetimi',
    dashF2: 'Grafik ve analizler',
    dashF3: 'Azaltma hedefleri',
    dashBtn: 'Dashboard\'a git',
    note: 'Her iki mod da aynı veritabanına yazar  -  istediğiniz zaman değiştirebilirsiniz.',
    logout: 'Farklı hesapla giriş yap',
  },
};

export default function SelectModePage() {
  const { language, changeLanguage } = useLanguage();
  const [hovered, setHovered] = useState(null);
  const t = texts[language] || texts.en;

  function go(mode) {
    document.cookie = 'carbonless_mode_chosen=1; path=/; SameSite=Lax';
    if (mode === 'ai') {
      // Signal dashboard to open AI directly
      localStorage.setItem('carbonless_startup_mode', 'ai');
      localStorage.setItem('carbonless_active_tab', 'ai_carbon');
      window.location.href = '/dashboard';
    } else {
      localStorage.setItem('carbonless_startup_mode', 'dashboard');
      localStorage.setItem('carbonless_active_tab', 'dashboard');
      window.location.href = '/dashboard';
    }
  }

  // Layout: the whole choice (logo, heading, both cards with their buttons) is meant to fit one screen on a laptop,
  // including a browser at 125-150% display scaling (a CSS viewport of about 1280 x 590), so the vertical spacing is
  // tight and the two cards share their rows (title / description / features / button line up on wide screens).
  // On a phone the cards stack and the page scrolls naturally. The language toggle is fixed, so it stays reachable.
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-4 sm:py-5 sm:[@media(min-height:800px)]:py-8"
      style={{ background: 'linear-gradient(135deg, #F1FCF2 0%, #f5f5f5 50%, #F1FCF2 100%)' }}>

      {/* Top row. On a phone: logo on the left, language toggle on the right, on one line (no extra height).
          From sm up: the logo is centred and the toggle is fixed at the top right, so it stays reachable while the
          page scrolls. */}
      <div className="mb-3 flex w-full max-w-3xl items-center justify-between sm:mb-4 sm:justify-center sm:[@media(min-height:800px)]:mb-6">
        <div className="flex items-center gap-2.5">
          <Image src="/carbonless.png" alt="Carbonless" width={40} height={40} className="h-9 w-9 object-contain sm:h-10 sm:w-10" />
          <span className="text-[20px] font-bold text-[#072C0E] tracking-tight">Carbonless</span>
        </div>
        <div className="sm:fixed sm:right-5 sm:top-4 sm:z-20">
          <div className="flex items-center gap-0.5 rounded-full bg-white border border-[#DEFAE1] p-0.5 shadow-sm">
            {['en', 'tr'].map(l => (
              <button
                key={l}
                onClick={() => changeLanguage(l)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase transition ${
                  language === l ? 'btn-dark' : 'text-[#072C0E]/40 hover:text-[#072C0E]'
                }`}
              >
                {l === 'en' ? 'EN' : 'TR'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Heading */}
      <div className="mb-4 text-center sm:mb-5 sm:[@media(min-height:800px)]:mb-7">
        <h1 className="text-[24px] sm:text-[30px] sm:[@media(min-height:800px)]:text-[34px] font-extrabold text-[#072C0E] tracking-tight leading-tight">
          {t.title}
        </h1>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] sm:text-[14px] text-[#072C0E]/55 leading-relaxed">
          {t.subtitle}
        </p>
      </div>

      {/* Choice cards. On sm+ both cards span the same four rows (subgrid), so title, description, features and
          button sit at the same height in both, whatever the language or the length of the text. */}
      <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-0 sm:[@media(min-height:800px)]:gap-x-5">

        {/* AI Mode */}
        <button
          onClick={() => go('ai')}
          onMouseEnter={() => setHovered('ai')}
          onMouseLeave={() => setHovered(null)}
          className="group relative flex flex-col items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] sm:row-span-4 sm:grid sm:grid-rows-subgrid sm:gap-y-3 sm:p-5 sm:[@media(min-height:800px)]:gap-y-4 sm:[@media(min-height:800px)]:p-7"
          style={{
            borderColor: hovered === 'ai' ? '#2ABD41' : '#DEFAE1',
            background: hovered === 'ai' ? 'linear-gradient(135deg, #F1FCF2, #F1FCF2)' : 'white',
            boxShadow: hovered === 'ai' ? '0 8px 32px rgba(42, 189, 65,0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          {/* Icon + title */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, #2ABD41, #1D9C31)' }}>
              <Brain className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-[18px] font-bold text-[#072C0E]">{t.aiTitle}</h2>
          </div>

          {/* Badge */}
          <div className="absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
            style={{ background: '#51D766', color: '#072C0E' }}>
            {t.recommended}
          </div>

          <p className="text-[13px] sm:[@media(min-height:800px)]:text-[14px] text-[#072C0E]/60 leading-relaxed">
            {t.aiDesc}
          </p>

          <ul className="space-y-1 text-[12px] sm:[@media(min-height:800px)]:space-y-1.5 sm:[@media(min-height:800px)]:text-[13px] text-[#072C0E]/60">
            <li className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 shrink-0" style={{color:'#2ABD41'}} />{t.aiF1}</li>
            <li className="flex items-center gap-2"><Leaf className="h-3.5 w-3.5 shrink-0" style={{color:'#2ABD41'}} />{t.aiF2}</li>
            <li className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 shrink-0" style={{color:'#2ABD41'}} />{t.aiF3}</li>
          </ul>

          <div className="mt-auto flex items-center gap-2 font-bold text-[13px] sm:mt-0 sm:self-end"
            style={{ color: '#2ABD41' }}>
            {t.aiBtn} <ArrowRight className="h-4 w-4" />
          </div>
        </button>

        {/* Dashboard Mode */}
        <button
          onClick={() => go('dashboard')}
          onMouseEnter={() => setHovered('dashboard')}
          onMouseLeave={() => setHovered(null)}
          className="group relative flex flex-col items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] sm:row-span-4 sm:grid sm:grid-rows-subgrid sm:gap-y-3 sm:p-5 sm:[@media(min-height:800px)]:gap-y-4 sm:[@media(min-height:800px)]:p-7"
          style={{
            borderColor: hovered === 'dashboard' ? '#51D766' : '#DEFAE1',
            background: hovered === 'dashboard' ? 'linear-gradient(135deg, #F1FCF2, #F1FCF2)' : 'white',
            boxShadow: hovered === 'dashboard' ? '0 8px 32px rgba(81, 215, 102,0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          {/* Icon + title */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(135deg, #51D766, #2ABD41)' }}>
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-[18px] font-bold text-[#072C0E]">{t.dashTitle}</h2>
          </div>

          <p className="text-[13px] sm:[@media(min-height:800px)]:text-[14px] text-[#072C0E]/60 leading-relaxed">
            {t.dashDesc}
          </p>

          <ul className="space-y-1 text-[12px] sm:[@media(min-height:800px)]:space-y-1.5 sm:[@media(min-height:800px)]:text-[13px] text-[#072C0E]/60">
            <li className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 shrink-0" style={{color:'#51D766'}} />{t.dashF1}</li>
            <li className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 shrink-0" style={{color:'#51D766'}} />{t.dashF2}</li>
            <li className="flex items-center gap-2"><Leaf className="h-3.5 w-3.5 shrink-0" style={{color:'#51D766'}} />{t.dashF3}</li>
          </ul>

          <div className="mt-auto flex items-center gap-2 font-bold text-[13px] sm:mt-0 sm:self-end"
            style={{ color: '#2ABD41' }}>
            {t.dashBtn} <ArrowRight className="h-4 w-4" />
          </div>
        </button>
      </div>

      {/* Note */}
      <p className="mt-4 sm:[@media(min-height:800px)]:mt-6 text-[11px] text-[#072C0E]/40 text-center">
        {t.note}
      </p>

      {/* Switch account */}
      <button
        onClick={() => {
          document.cookie = 'carbonless_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          document.cookie = '_carbonless_refresh=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          document.cookie = 'carbonless_mode_chosen=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          localStorage.removeItem('_ca');
          window.location.href = '/login';
        }}
        className="mt-2 text-[11px] text-[#072C0E]/40 hover:text-[#072C0E]/60 transition underline underline-offset-2"
      >
        {t.logout}
      </button>
    </div>
  );
}
