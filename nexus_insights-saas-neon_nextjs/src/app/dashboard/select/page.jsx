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
    aiDesc: 'Tell your data to AI, it calculates automatically and prepares ISO 14064-1 reports.',
    aiF1: 'Natural language data entry',
    aiF2: 'Automatic emission calculation',
    aiF3: 'AI-powered reporting',
    aiBtn: 'Start with AI',
    dashTitle: 'Dashboard',
    dashDesc: 'Enter data manually from forms, view charts and reports.',
    dashF1: 'Detailed emission management',
    dashF2: 'Charts and analytics',
    dashF3: 'Reduction targets',
    dashBtn: 'Go to Dashboard',
    note: 'Both modes write to the same database — you can switch anytime.',
    logout: 'Sign in with different account',
  },
  tr: {
    title: 'Bugün nasıl çalışmak istersiniz?',
    subtitle: 'Her iki yol da aynı veritabanına kaydeder. İstediğiniz zaman geçiş yapabilirsiniz.',
    recommended: 'Önerilen',
    aiTitle: 'AI Hesaplayıcı',
    aiDesc: 'Verilerinizi AI\'a söyleyin, otomatik hesaplasın ve ISO 14064-1 raporu hazırlasın.',
    aiF1: 'Doğal dil ile veri girişi',
    aiF2: 'Otomatik emisyon hesaplama',
    aiF3: 'AI destekli raporlama',
    aiBtn: 'AI ile başla',
    dashTitle: 'Kontrol Paneli',
    dashDesc: 'Formlardan manuel veri girin, grafikler ve raporları görüntüleyin.',
    dashF1: 'Detaylı emisyon yönetimi',
    dashF2: 'Grafik ve analizler',
    dashF3: 'Azaltma hedefleri',
    dashBtn: 'Dashboard\'a git',
    note: 'Her iki mod da aynı veritabanına yazar — istediğiniz zaman değiştirebilirsiniz.',
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
      window.location.href = '/dashboard';
    } else {
      localStorage.setItem('carbonless_startup_mode', 'dashboard');
      window.location.href = '/dashboard';
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'linear-gradient(135deg, #f0f7f3 0%, #f5f5f5 50%, #f9f9e8 100%)' }}>

      {/* Language toggle - top right */}
      <div className="absolute top-5 right-5">
        <div className="flex items-center gap-0.5 rounded-full bg-white border border-[#e8e8e0] p-0.5 shadow-sm">
          {['en', 'tr'].map(l => (
            <button
              key={l}
              onClick={() => changeLanguage(l)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase transition ${
                language === l ? 'bg-[#1a1a1a] text-white' : 'text-[#1a1a1a]/40 hover:text-[#1a1a1a]'
              }`}
            >
              {l === 'en' ? 'EN' : 'TR'}
            </button>
          ))}
        </div>
      </div>

      {/* Logo */}
      <div className="mb-10 flex items-center gap-2.5">
        <Image src="/carbonless.png" alt="Carbonless" width={40} height={40} className="h-10 w-10 object-contain" />
        <span className="text-[20px] font-bold text-[#1a1a1a] tracking-tight">Carbonless</span>
      </div>

      {/* Heading */}
      <div className="text-center mb-10">
        <h1 className="text-[28px] sm:text-[34px] font-extrabold text-[#1a1a1a] tracking-tight leading-tight">
          {t.title}
        </h1>
        <p className="mt-3 text-[14px] text-[#1a1a1a]/50 max-w-sm mx-auto leading-relaxed">
          {t.subtitle}
        </p>
      </div>

      {/* Choice cards */}
      <div className="grid sm:grid-cols-2 gap-5 w-full max-w-2xl">

        {/* AI Mode */}
        <button
          onClick={() => go('ai')}
          onMouseEnter={() => setHovered('ai')}
          onMouseLeave={() => setHovered(null)}
          className="group relative flex flex-col items-start gap-5 rounded-2xl border-2 p-7 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
          style={{
            borderColor: hovered === 'ai' ? '#53A67F' : '#e0e0e0',
            background: hovered === 'ai' ? 'linear-gradient(135deg, #f0f7f3, #e8f5ef)' : 'white',
            boxShadow: hovered === 'ai' ? '0 8px 32px rgba(83,166,127,0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          {/* Icon */}
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #53A67F, #3d8564)' }}>
            <Brain className="h-7 w-7 text-white" />
          </div>

          {/* Badge */}
          <div className="absolute top-4 right-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
            style={{ background: '#C9C858', color: '#1a1a1a' }}>
            {t.recommended}
          </div>

          <div>
            <h2 className="text-[18px] font-bold text-[#1a1a1a]">{t.aiTitle}</h2>
            <p className="mt-1.5 text-[13px] text-[#1a1a1a]/55 leading-relaxed">
              {t.aiDesc}
            </p>
          </div>

          <ul className="space-y-1.5 text-[12px] text-[#1a1a1a]/55">
            <li className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" style={{color:'#53A67F'}} />{t.aiF1}</li>
            <li className="flex items-center gap-2"><Leaf className="h-3.5 w-3.5" style={{color:'#53A67F'}} />{t.aiF2}</li>
            <li className="flex items-center gap-2"><Activity className="h-3.5 w-3.5" style={{color:'#53A67F'}} />{t.aiF3}</li>
          </ul>

          <div className="flex items-center gap-2 font-bold text-[13px] mt-auto"
            style={{ color: '#53A67F' }}>
            {t.aiBtn} <ArrowRight className="h-4 w-4" />
          </div>
        </button>

        {/* Dashboard Mode */}
        <button
          onClick={() => go('dashboard')}
          onMouseEnter={() => setHovered('dashboard')}
          onMouseLeave={() => setHovered(null)}
          className="group relative flex flex-col items-start gap-5 rounded-2xl border-2 p-7 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
          style={{
            borderColor: hovered === 'dashboard' ? '#C9C858' : '#e0e0e0',
            background: hovered === 'dashboard' ? 'linear-gradient(135deg, #fdfde8, #f9f9e0)' : 'white',
            boxShadow: hovered === 'dashboard' ? '0 8px 32px rgba(201,200,88,0.15)' : '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          {/* Icon */}
          <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #C9C858, #a8a73a)' }}>
            <BarChart3 className="h-7 w-7 text-white" />
          </div>

          <div>
            <h2 className="text-[18px] font-bold text-[#1a1a1a]">{t.dashTitle}</h2>
            <p className="mt-1.5 text-[13px] text-[#1a1a1a]/55 leading-relaxed">
              {t.dashDesc}
            </p>
          </div>

          <ul className="space-y-1.5 text-[12px] text-[#1a1a1a]/55">
            <li className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5" style={{color:'#C9C858'}} />{t.dashF1}</li>
            <li className="flex items-center gap-2"><Activity className="h-3.5 w-3.5" style={{color:'#C9C858'}} />{t.dashF2}</li>
            <li className="flex items-center gap-2"><Leaf className="h-3.5 w-3.5" style={{color:'#C9C858'}} />{t.dashF3}</li>
          </ul>

          <div className="flex items-center gap-2 font-bold text-[13px] mt-auto"
            style={{ color: '#a8a73a' }}>
            {t.dashBtn} <ArrowRight className="h-4 w-4" />
          </div>
        </button>
      </div>

      {/* Note */}
      <p className="mt-8 text-[11px] text-[#1a1a1a]/35 text-center">
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
        className="mt-4 text-[11px] text-[#1a1a1a]/30 hover:text-[#1a1a1a]/60 transition underline underline-offset-2"
      >
        {t.logout}
      </button>
    </div>
  );
}
