'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Globe2, Leaf, Brain, Sparkles, BarChart3, Zap, TreePine, Factory, CloudSun, Wind, Flame, Droplets } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* -- Copy -- */
const copy = {
  en: {
    nav: { home: 'Home', about: 'About', features: 'Features', ai: 'AI', login: 'Login' },
    hero: {
      line1: 'Your AI-powered',
      highlight: 'carbon calculator',
      line2: 'platform.',
      desc: 'Measure your company\'s carbon footprint with AI guidance. Build ISO 14064-1 compliant reports that actually matter.',
      cta: 'Get Started Free',
      demo: 'Request Demo',
    },
  },
  tr: {
    nav: { home: 'Ana Sayfa', about: 'Hakkinda', features: 'Özellikler', ai: 'AI', login: 'Giris' },
    hero: {
      line1: 'AI destekli',
      highlight: 'karbon hesaplama',
      line2: 'platformunuz.',
      desc: 'AI rehberligiyle sirketinizin karbon ayak izini ölçün. Gerçekten önemli olan ISO 14064-1 uyumlu raporlar olusturun.',
      cta: 'Ücretsiz Baslayin',
      demo: 'Demo Talep Et',
    },
  },
};

/* -- Floating node component -- */
function FloatingNode({ icon: Icon, label, className, delay = 0, color = 'text-[#302817]/70' }) {
  return (
    <div className={`absolute ${className} animate-float`} style={{ animationDelay: `${delay}s` }}>
      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-full bg-white shadow-lg shadow-black/8 border border-[#e8e8e0] flex items-center justify-center">
            <Icon className={`h-4 w-4 sm:h-6 sm:w-6 ${color}`} />
          </div>
          <div className="absolute -top-0.5 -right-0.5 h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-[#53A67F] border-2 border-white" />
        </div>
        {label && (
          <span className="hidden sm:block rounded-full bg-[#f0f4e8] border border-[#d4deb8] px-2.5 py-0.5 text-[10px] font-semibold text-[#5a6b2a]">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

/* -- Connection lines SVG -- */
function ConnectionLines() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.12]" viewBox="0 0 1200 700">
      {/* Lines connecting nodes */}
      <line x1="150" y1="120" x2="350" y2="250" stroke="#6B8E23" strokeWidth="1" />
      <line x1="150" y1="350" x2="350" y2="300" stroke="#6B8E23" strokeWidth="1" />
      <line x1="100" y1="500" x2="300" y2="400" stroke="#6B8E23" strokeWidth="1" />
      <line x1="850" y1="100" x2="700" y2="250" stroke="#6B8E23" strokeWidth="1" />
      <line x1="1050" y1="200" x2="850" y2="300" stroke="#6B8E23" strokeWidth="1" />
      <line x1="1000" y1="400" x2="800" y2="350" stroke="#6B8E23" strokeWidth="1" />
      <line x1="1100" y1="500" x2="900" y2="420" stroke="#6B8E23" strokeWidth="1" />
      <line x1="200" y1="200" x2="180" y2="400" stroke="#6B8E23" strokeWidth="0.8" />
      <line x1="950" y1="150" x2="1050" y2="350" stroke="#6B8E23" strokeWidth="0.8" />
      {/* Diagonal cross lines */}
      <line x1="300" y1="150" x2="500" y2="320" stroke="#6B8E23" strokeWidth="0.6" />
      <line x1="700" y1="150" x2="900" y2="300" stroke="#6B8E23" strokeWidth="0.6" />
    </svg>
  );
}

/* -- Page -- */
export default function Home() {
  const { language: lang, changeLanguage } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef(null);

  useEffect(() => {
    if (!showLangMenu) return;
    const onKey = e => { if (e.key === 'Escape') setShowLangMenu(false); };
    const onClick = e => { if (langMenuRef.current && !langMenuRef.current.contains(e.target)) setShowLangMenu(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [showLangMenu]);

  const t = copy[lang] ?? copy['en'];

  return (
    <main className="min-h-screen bg-white relative overflow-hidden">

      {/* -- Global float animation via tailwind -- */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}} />

      {/* -- Navbar -- */}
      <header className="relative z-50 mx-auto flex h-16 max-w-6xl items-center justify-center px-5 sm:px-8 pt-4">
        <nav className="flex items-center gap-1 rounded-full border border-[#e8e8e0] bg-white/90 backdrop-blur-sm px-2 py-1.5 shadow-sm">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 px-3 py-1.5">
            <Image src="/carbonless.png" alt="Carbonless" width={28} height={28} className="h-7 w-7 object-contain" />
            <span className="text-[15px] font-bold tracking-tight text-[#302817]">Carbonless</span>
          </Link>

          {/* Nav links */}
          <div className="hidden sm:flex items-center gap-0.5 ml-2">
            {['home', 'about', 'ai'].map(key => (
              <a key={key} href={key === 'home' ? '/' : key === 'ai' ? '/dashboard/select' : `#${key}`}
                className="px-3.5 py-1.5 rounded-full text-[13px] font-medium text-[#302817]/60 hover:text-[#302817] hover:bg-[#f5f5f0] transition">
                {key === 'home' ? (lang === 'tr' ? 'Ana Sayfa' : 'Home') : key === 'about' ? (lang === 'tr' ? 'Hakkinda' : 'About') : 'AI'}
              </a>
            ))}
          </div>

          {/* Login & Create Account */}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-2">
            <Link href="/login"
              className="hidden sm:block px-3.5 py-1.5 rounded-full text-[13px] font-medium text-[#302817]/60 hover:text-[#302817] hover:bg-[#f5f5f0] transition">
              {lang === 'tr' ? 'Giris Yap' : 'Log In'}
            </Link>
            <Link href="/register"
              className="px-3 sm:px-4 py-1.5 rounded-full bg-[#1a1a1a] text-[11px] sm:text-[12px] font-bold text-white hover:bg-[#333] transition">
              {lang === 'tr' ? 'Hesap Olustur' : 'Create Account'}
            </Link>
          </div>

          {/* Lang */}
          <div className="relative ml-2" ref={langMenuRef}>
            <button
              onClick={() => setShowLangMenu(v => !v)}
              className="px-2.5 py-1.5 rounded-full text-[12px] font-semibold text-[#302817]/50 hover:bg-[#f5f5f0] transition uppercase"
            >
              {lang}
            </button>
            {showLangMenu && (
              <div className="absolute right-0 top-full z-50 mt-2 w-32 overflow-hidden rounded-xl border border-[#e8e8e0] bg-white shadow-xl">
                {['en', 'tr'].map(l => (
                  <button key={l} onClick={() => { changeLanguage(l); setShowLangMenu(false); }}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-xs font-semibold transition hover:bg-[#f9faf5] ${lang === l ? 'text-[#53A67F]' : 'text-[#302817]/60'}`}>
                    {l === 'en' ? 'EN - English' : 'TR - Turkce'} {lang === l && '\u2713'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* -- Hero Section -- */}
      <section className="relative min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-5 sm:px-8">

        {/* Connection lines background  -  tablet+ only */}
        <div className="hidden sm:block">
          <ConnectionLines />
        </div>

        {/* Floating nodes  -  tablet (sm-lg): 4 nodes, desktop (lg+): all */}
        <div className="hidden sm:block lg:hidden">
          <FloatingNode icon={Factory} label="Scope 1" className="top-[15%] left-[6%]" delay={0} color="text-orange-500" />
          <FloatingNode icon={Brain} label="AI Engine" className="top-[15%] right-[6%]" delay={0.4} color="text-purple-500" />
          <FloatingNode icon={Zap} label="Scope 2" className="top-[5%] left-[40%]" delay={1.0} color="text-yellow-600" />
          <FloatingNode icon={Wind} label="Scope 3" className="bottom-[20%] left-[8%]" delay={1.6} color="text-sky-500" />
          <FloatingNode icon={TreePine} label="Net Zero" className="bottom-[20%] right-[8%]" delay={0.6} color="text-[#6B8E23]" />
        </div>

        {/* All nodes on desktop */}
        <div className="hidden lg:block">
          <FloatingNode icon={Factory} label="Scope 1" className="top-[12%] left-[8%]" delay={0} color="text-orange-500" />
          <FloatingNode icon={Zap} label="Scope 2" className="top-[35%] left-[6%]" delay={0.8} color="text-yellow-600" />
          <FloatingNode icon={Wind} label="Scope 3" className="top-[58%] left-[12%]" delay={1.6} color="text-sky-500" />
          <FloatingNode icon={Droplets} label="ISO 14064" className="bottom-[15%] left-[7%]" delay={2.2} color="text-blue-500" />
          <FloatingNode icon={Brain} label="AI Engine" className="top-[10%] right-[10%]" delay={0.4} color="text-purple-500" />
          <FloatingNode icon={Sparkles} label="Smart Report" className="top-[32%] right-[5%]" delay={1.2} color="text-[#53A67F]" />
          <FloatingNode icon={BarChart3} label="Analytics" className="top-[55%] right-[12%]" delay={2.0} color="text-emerald-600" />
          <FloatingNode icon={TreePine} label="Net Zero" className="bottom-[18%] right-[8%]" delay={0.6} color="text-[#6B8E23]" />
          <FloatingNode icon={Flame} className="top-[22%] left-[22%]" delay={1.4} color="text-red-400" />
          <FloatingNode icon={CloudSun} className="top-[18%] right-[24%]" delay={1.8} color="text-sky-400" />
          <FloatingNode icon={Leaf} className="bottom-[28%] left-[20%]" delay={2.4} color="text-[#53A67F]" />
          <FloatingNode icon={Globe2} className="bottom-[22%] right-[20%]" delay={0.2} color="text-teal-500" />
        </div>

        {/* -- Center content -- */}
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          {/* Main title */}
          <h1 className="text-[28px] sm:text-[44px] lg:text-[72px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#1a1a1a]">
            {t.hero.line1}{' '}
            <span className="text-[#53A67F]">{t.hero.highlight}</span>{' '}
            {t.hero.line2}
          </h1>

          {/* Description */}
          <p className="mt-6 text-[16px] sm:text-[18px] leading-relaxed text-[#302817]/55 max-w-xl mx-auto">
            {t.hero.desc}
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register"
              className="flex items-center gap-3 rounded-full bg-[#1a1a1a] pl-6 pr-3 py-3 text-[14px] font-bold text-white shadow-lg shadow-black/15 hover:bg-[#333] transition hover:-translate-y-0.5">
              <span>{t.hero.cta}</span>
              <div className="h-8 w-8 rounded-full bg-[#53A67F] flex items-center justify-center">
                <Leaf className="h-4 w-4 text-white" />
              </div>
            </Link>
            <Link href="/login"
              className="flex items-center gap-3 rounded-full border-2 border-[#e8e8e0] bg-white px-6 py-3 text-[14px] font-bold text-[#302817]/70 shadow-sm hover:border-[#53A67F]/40 hover:text-[#302817] transition">
              <Brain className="h-4 w-4 text-[#53A67F]" />
              <span>{t.hero.demo}</span>
            </Link>
          </div>
        </div>

      </section>

      {/* -- AI Section (like Dinnect AI) -- */}
      <section id="ai" className="relative z-10 py-20 sm:py-28 bg-white">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Left: Text */}
            <div>
              <h2 className="text-[36px] sm:text-[48px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#1a1a1a]">
                Carbonless <span className="text-[#53A67F]">AI</span>
              </h2>
              <p className="mt-5 text-[15px] leading-[1.8] text-[#302817]/55 max-w-md">
                {lang === 'tr'
                  ? 'Tüm karbon hesaplama ihtiyaçlariniz için tek AI. Emisyon verilerinizi söyleyin, biz hesaplayalim, raporlayalim ve azaltma stratejileri önerelim.'
                  : 'One AI for all your carbon needs. Tell us your emission data  -  we calculate, report, and suggest reduction strategies. Powered by CarbonIQ engine.'}
              </p>

              {/* Feature list */}
              <div className="mt-8 space-y-4">
                {(lang === 'tr' ? [
                  'AI destekli emisyon hesaplama ve siniflandirma',
                  'ISO 14064-1 uyumlu otomatik rapor olusturma',
                  'Dogal dil ile veri girisi  -  sadece konusun',
                  'Saniyeler içinde karbon ayak izi analizi',
                ] : [
                  'AI-driven emission calculation and classification',
                  'ISO 14064-1 compliant automated report generation',
                  'Natural language data entry  -  just talk',
                  'Carbon footprint analysis generated in seconds',
                ]).map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg bg-[#f0f9f0] border border-[#53A67F]/15 flex items-center justify-center shrink-0">
                      <svg className="h-3.5 w-3.5 text-[#53A67F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-[14px] text-[#302817]/70 font-medium">{item}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Link href="/register"
                className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#1a1a1a] px-8 py-3.5 text-[14px] font-bold text-white shadow-lg hover:bg-[#333] transition hover:-translate-y-0.5">
                {lang === 'tr' ? 'Daha Fazla' : 'Learn More'}
              </Link>
            </div>

            {/* Right: Device mockup with carbon-hero image */}
            <div className="relative flex items-center justify-center">
              {/* Laptop frame */}
              <div className="relative w-full max-w-[480px]">
                <div className="rounded-2xl border border-[#e0e0e0] bg-[#f8f8f8] p-2 shadow-2xl shadow-black/10">
                  {/* Browser chrome */}
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-t-xl bg-[#f0f0f0] border-b border-[#e0e0e0]">
                    <div className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                    <div className="h-2 w-2 rounded-full bg-[#febc2e]" />
                    <div className="h-2 w-2 rounded-full bg-[#28c840]" />
                    <div className="flex-1 flex justify-center">
                      <div className="rounded-md bg-white border border-[#e0e0e0] px-4 py-0.5 text-[9px] text-[#302817]/40 font-medium">
                        carbonless.app
                      </div>
                    </div>
                  </div>
                  {/* Screen content */}
                  <div className="bg-white rounded-b-xl p-6 flex flex-col items-center">
                    <Image src="/carbon-hero.png" alt="CarbonIQ AI" width={200} height={200} className="h-32 w-32 object-contain mb-4" />
                    <p className="text-[11px] text-[#302817]/40 mb-1">Hi, there</p>
                    <p className="text-[16px] font-bold text-[#1a1a1a]">
                      {lang === 'tr' ? 'Size nasil yardimci olabilirim?' : 'How can I assist?'}
                    </p>
                    <div className="mt-4 w-full rounded-xl border border-[#e8e8e0] px-4 py-2.5 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#53A67F]/40" />
                      <span className="text-[12px] text-[#302817]/30">Ask CarbonIQ...</span>
                    </div>
                    {/* Suggestion chips */}
                    <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                      {['Scopes', 'Analytics', 'Report', 'Targets'].map(chip => (
                        <span key={chip} className="rounded-full border border-[#e8e8e0] bg-[#fafafa] px-2.5 py-1 text-[9px] font-medium text-[#302817]/50">
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -- Pricing Section -- */}
      <section id="pricing" className="relative z-10 py-20 sm:py-28 bg-[#fafaf8] border-t border-[#e8e8e0]">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-[32px] sm:text-[40px] font-extrabold tracking-[-0.02em] text-[#1a1a1a]">
              {lang === 'tr' ? 'Basit fiyatlandirma' : 'Simple pricing'}
            </h2>
            <p className="mt-3 text-[15px] text-[#302817]/50">
              {lang === 'tr' ? 'Her büyüklükteki sirket için uygun planlar.' : 'Plans that fit companies of every size.'}
            </p>
          </div>

          {/* Cards */}
          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">

            {/* Free Plan */}
            <div className="rounded-2xl border border-[#e8e8e0] bg-white p-7 shadow-sm">
              <div className="mb-6">
                <p className="text-[14px] font-bold text-[#302817]/80">{lang === 'tr' ? 'Ücretsiz' : 'Free'}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[36px] font-extrabold text-[#1a1a1a]">$0</span>
                  <span className="text-[14px] text-[#302817]/40">/ {lang === 'tr' ? 'ay' : 'month'}</span>
                </div>
                <p className="mt-2 text-[13px] text-[#302817]/50">
                  {lang === 'tr' ? 'Küçük ekipler için temel karbon hesaplama.' : 'Basic carbon calculation for small teams.'}
                </p>
              </div>
              <div className="space-y-3 mb-8">
                {(lang === 'tr' ? [
                  'Dashboard veri girisi',
                  'Temel emisyon hesaplama',
                  'Sektör benchmarki',
                  'Aylik 5 AI soru',
                ] : [
                  'Dashboard data entry',
                  'Basic emission calculations',
                  'Sector benchmark',
                  '5 AI questions / month',
                ]).map(f => (
                  <div key={f} className="flex items-center gap-2.5">
                    <svg className="h-4 w-4 text-[#53A67F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[13px] text-[#302817]/65">{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/register"
                className="block w-full rounded-full border-2 border-[#e8e8e0] py-3 text-center text-[13px] font-bold text-[#302817]/60 hover:border-[#302817]/30 hover:text-[#302817] transition">
                {lang === 'tr' ? 'Ücretsiz Basla' : 'Get Started'}
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="relative rounded-2xl border-2 border-[#53A67F] bg-white p-7 shadow-lg shadow-[#53A67F]/5">
              {/* Popular badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#53A67F] px-4 py-1 text-[10px] font-bold text-white uppercase tracking-wide">
                {lang === 'tr' ? 'Popüler' : 'Popular'}
              </div>
              <div className="mb-6">
                <p className="text-[14px] font-bold text-[#53A67F]">Pro</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[36px] font-extrabold text-[#1a1a1a]">$49</span>
                  <span className="text-[14px] text-[#302817]/40">/ {lang === 'tr' ? 'ay' : 'month'}</span>
                </div>
                <p className="mt-2 text-[13px] text-[#302817]/50">
                  {lang === 'tr' ? 'AI destekli tam karbon yönetim platformu.' : 'Full AI-powered carbon management platform.'}
                </p>
              </div>
              <div className="space-y-3 mb-8">
                {(lang === 'tr' ? [
                  'Ücretsiz\'deki her sey',
                  'Sinirsiz AI karbon hesaplama',
                  'ISO 14064-1 PDF raporu',
                  'Hedefler ve ilerleme takibi',
                  'AI rehberli anket (133 soru)',
                  'Danisman onay sistemi',
                  'Excel/CSV disa aktarma',
                ] : [
                  'Everything in Free',
                  'Unlimited AI carbon calculations',
                  'ISO 14064-1 PDF report',
                  'Goals and progress tracking',
                  'AI guided questionnaire (133 questions)',
                  'Consultant approval system',
                  'Excel/CSV export',
                ]).map(f => (
                  <div key={f} className="flex items-center gap-2.5">
                    <svg className="h-4 w-4 text-[#53A67F] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[13px] text-[#302817]/65">{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/register"
                className="block w-full rounded-full bg-[#53A67F] py-3 text-center text-[13px] font-bold text-white shadow-sm hover:bg-[#3d8564] transition">
                {lang === 'tr' ? 'Pro\'ya Geç' : 'Go Pro'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -- Footer strip -- */}
      <footer className="relative z-10 border-t border-[#e8e8e0] bg-white/80 backdrop-blur-sm py-5">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Image src="/carbonless.png" alt="Carbonless" width={16} height={16} className="h-4 w-4 object-contain" />
            <span className="text-[12px] font-medium text-[#302817]/40">© 2024 Carbonless. All rights reserved.</span>
          </div>
          <div className="flex gap-4">
            <Link href="/terms" className="text-[12px] text-[#302817]/40 hover:text-[#302817]/70 transition">
              {lang === 'tr' ? 'Kullanim Kosullari' : 'Terms'}
            </Link>
            <Link href="/privacy" className="text-[12px] text-[#302817]/40 hover:text-[#302817]/70 transition">
              {lang === 'tr' ? 'Gizlilik' : 'Privacy'}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
