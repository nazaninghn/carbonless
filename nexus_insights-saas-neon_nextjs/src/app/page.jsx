'use client';

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
      desc: '',
      cta: 'Get Started Free',
      demo: 'Request Demo',
    },
  },
  tr: {
    nav: { home: 'Ana Sayfa', about: 'Hakkında', features: 'Özellikler', ai: 'AI', login: 'Giriş' },
    hero: {
      line1: 'AI destekli',
      highlight: 'karbon hesaplama',
      line2: 'platformunuz.',
      desc: '',
      cta: 'Ücretsiz Başlayın',
      demo: 'Demo Talep Et',
    },
  },
};

/* -- Floating node component --
   Interactive hero icons (Dinnect-style floating cards): squircle gradient
   tile, hover = lift + green glow + label fills green; labelled nodes are
   clickable links, unlabelled ones stay purely decorative. */
function FloatingNode({ icon: Icon, label, className, delay = 0, color = 'text-[#1A7B2A]', href = null }) {
  const inner = (
    <>
      <div className="relative transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-translate-y-1.5">
        {/* soft glow behind the tile, only visible on hover */}
        <div className="absolute -inset-2 rounded-3xl bg-[#2ABD41]/0 blur-xl transition-colors duration-300 group-hover:bg-[#2ABD41]/25" />
        <div className="relative flex h-11 w-11 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-[#DEFAE1] bg-gradient-to-br from-white to-[#F1FCF2] shadow-lg shadow-[#072C0E]/8 transition-all duration-300 group-hover:border-[#8BEA99] group-hover:shadow-xl group-hover:shadow-[#2ABD41]/25">
          <Icon className={`h-5 w-5 sm:h-7 sm:w-7 ${color} transition-transform duration-300 group-hover:scale-110`} strokeWidth={1.8} />
        </div>
        <div className="absolute -top-1 -right-1 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-[#2ABD41] border-2 border-white transition-transform duration-300 group-hover:scale-125" />
      </div>
      {label && (
        <span className="hidden sm:block rounded-full border border-[#DEFAE1] bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-[#1A7B2A] shadow-sm backdrop-blur-sm transition-all duration-300 group-hover:border-[#2ABD41] group-hover:bg-[#2ABD41] group-hover:text-white">
          {label}
        </span>
      )}
    </>
  );
  return (
    <div className={`absolute ${className} animate-float`} style={{ animationDelay: `${delay}s` }}>
      {href ? (
        <Link href={href} aria-label={label} className="group flex cursor-pointer flex-col items-center gap-1.5">
          {inner}
        </Link>
      ) : (
        <div className="group flex flex-col items-center gap-1.5">{inner}</div>
      )}
    </div>
  );
}

/* -- Connection lines SVG -- */
function ConnectionLines() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.12]" viewBox="0 0 1200 700">
      {/* Lines connecting nodes */}
      <line x1="150" y1="120" x2="350" y2="250" stroke="#2ABD41" strokeWidth="1" />
      <line x1="150" y1="350" x2="350" y2="300" stroke="#2ABD41" strokeWidth="1" />
      <line x1="100" y1="500" x2="300" y2="400" stroke="#2ABD41" strokeWidth="1" />
      <line x1="850" y1="100" x2="700" y2="250" stroke="#2ABD41" strokeWidth="1" />
      <line x1="1050" y1="200" x2="850" y2="300" stroke="#2ABD41" strokeWidth="1" />
      <line x1="1000" y1="400" x2="800" y2="350" stroke="#2ABD41" strokeWidth="1" />
      <line x1="1100" y1="500" x2="900" y2="420" stroke="#2ABD41" strokeWidth="1" />
      <line x1="200" y1="200" x2="180" y2="400" stroke="#2ABD41" strokeWidth="0.8" />
      <line x1="950" y1="150" x2="1050" y2="350" stroke="#2ABD41" strokeWidth="0.8" />
      {/* Diagonal cross lines */}
      <line x1="300" y1="150" x2="500" y2="320" stroke="#2ABD41" strokeWidth="0.6" />
      <line x1="700" y1="150" x2="900" y2="300" stroke="#2ABD41" strokeWidth="0.6" />
    </svg>
  );
}

/* -- Page -- */
export default function Home() {
  const { language: lang, changeLanguage } = useLanguage();

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
        .animate-float:hover {
          animation-play-state: paused;
        }
      `}} />

      {/* -- Navbar — Dinnect-style floating pill: detached rounded capsule
             centered at the top, hovering over the hero. Logo + wordmark |
             divider | nav links | divider | lang, Log In, solid green CTA.
             Every item has a visible hover state. The sticky wrapper is
             pointer-events-none so content beside the pill stays clickable;
             no overflow-hidden anywhere (that's what clipped the old
             language dropdown). -- */}
      <header className="pointer-events-none sticky top-0 z-50 flex w-full justify-center px-3 pt-4">
        <nav className="pointer-events-auto flex h-14 max-w-full items-center gap-0.5 rounded-full border border-[#DEFAE1] bg-white/95 px-2 sm:px-3 shadow-[0_8px_30px_rgba(7,44,14,0.10)] backdrop-blur-md">
          {/* Logo */}
          <Link href="/" className="group flex shrink-0 items-center gap-2 rounded-full px-2 sm:px-3 py-1.5 transition-colors hover:bg-[#F1FCF2]">
            <Image src="/carbonless.png" alt="Carbonless" width={32} height={32} className="h-7 w-7 sm:h-8 sm:w-8 object-contain transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
            <span className="text-[15px] sm:text-[16px] font-bold tracking-tight text-[#072C0E]">Carbonless</span>
          </Link>

          {/* Divider */}
          <span className="hidden md:block mx-1 h-6 w-px bg-[#DEFAE1]" />

          {/* Nav links */}
          <div className="hidden md:flex items-center">
            {['home', 'about', 'ai'].map(key => (
              <a key={key} href={key === 'home' ? '/' : key === 'ai' ? '/dashboard/select' : `#${key}`}
                className="rounded-full px-4 py-2 text-[13.5px] font-medium text-[#072C0E]/55 transition-all duration-200 hover:bg-[#F1FCF2] hover:text-[#072C0E]">
                {key === 'home' ? (lang === 'tr' ? 'Ana Sayfa' : 'Home') : key === 'about' ? (lang === 'tr' ? 'Hakkında' : 'About') : 'AI'}
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
        </nav>
      </header>

      {/* -- Hero Section — pull up under the floating pill -- */}
      <section className="relative -mt-[72px] min-h-screen flex flex-col items-center justify-center px-5 sm:px-8">

        {/* Connection lines background  -  tablet+ only */}
        <div className="hidden sm:block">
          <ConnectionLines />
        </div>

        {/* Floating nodes  -  tablet (sm-lg): 5 nodes, desktop (lg+): all */}
        <div className="hidden sm:block lg:hidden">
          <FloatingNode icon={Factory} label="Scope 1" className="top-[15%] left-[6%]" delay={0} color="text-orange-500" href="#ai" />
          <FloatingNode icon={Brain} label="AI Engine" className="top-[15%] right-[6%]" delay={0.4} color="text-purple-500" href="/dashboard/select" />
          <FloatingNode icon={Zap} label="Scope 2" className="top-[5%] left-[40%]" delay={1.0} color="text-yellow-600" href="#ai" />
          <FloatingNode icon={Wind} label="Scope 3" className="bottom-[20%] left-[8%]" delay={1.6} color="text-sky-500" href="#ai" />
          <FloatingNode icon={TreePine} label="Net Zero" className="bottom-[20%] right-[8%]" delay={0.6} color="text-[#2ABD41]" href="#pricing" />
        </div>

        {/* All nodes on desktop */}
        <div className="hidden lg:block">
          <FloatingNode icon={Factory} label="Scope 1" className="top-[12%] left-[8%]" delay={0} color="text-orange-500" href="#ai" />
          <FloatingNode icon={Zap} label="Scope 2" className="top-[35%] left-[6%]" delay={0.8} color="text-yellow-600" href="#ai" />
          <FloatingNode icon={Wind} label="Scope 3" className="top-[58%] left-[12%]" delay={1.6} color="text-sky-500" href="#ai" />
          <FloatingNode icon={Droplets} label="ISO 14064" className="bottom-[15%] left-[7%]" delay={2.2} color="text-blue-500" href="#ai" />
          <FloatingNode icon={Brain} label="AI Engine" className="top-[10%] right-[10%]" delay={0.4} color="text-purple-500" href="/dashboard/select" />
          <FloatingNode icon={Sparkles} label="Smart Report" className="top-[32%] right-[5%]" delay={1.2} color="text-[#2ABD41]" href="#ai" />
          <FloatingNode icon={BarChart3} label="Analytics" className="top-[55%] right-[12%]" delay={2.0} color="text-emerald-600" href="#ai" />
          <FloatingNode icon={TreePine} label="Net Zero" className="bottom-[18%] right-[8%]" delay={0.6} color="text-[#2ABD41]" href="#pricing" />
          <FloatingNode icon={Flame} className="top-[22%] left-[22%]" delay={1.4} color="text-red-400" />
          <FloatingNode icon={CloudSun} className="top-[18%] right-[24%]" delay={1.8} color="text-sky-400" />
          <FloatingNode icon={Leaf} className="bottom-[28%] left-[20%]" delay={2.4} color="text-[#2ABD41]" />
          <FloatingNode icon={Globe2} className="bottom-[22%] right-[20%]" delay={0.2} color="text-teal-500" />
        </div>

        {/* -- Center content -- */}
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          {/* Main title */}
          <h1 className="text-[28px] sm:text-[44px] lg:text-[72px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#072C0E]">
            {t.hero.line1}{' '}
            <span className="text-[#2ABD41]">{t.hero.highlight}</span>{' '}
            {t.hero.line2}
          </h1>

          {/* Description - only render if content exists */}
          {t.hero.desc && (
            <p className="mt-6 text-[16px] sm:text-[18px] leading-relaxed text-[#072C0E]/55 max-w-xl mx-auto">
              {t.hero.desc}
            </p>
          )}

          {/* CTA Buttons */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full px-4 sm:px-0">
            <Link href="/register"
              className="flex w-full sm:w-auto items-center justify-center gap-3 rounded-full bg-[#072C0E] pl-6 pr-3 py-3 text-[13px] sm:text-[14px] font-bold text-white shadow-lg shadow-black/15 hover:bg-[#175022] transition hover:-translate-y-0.5">
              <span>{t.hero.cta}</span>
              <div className="h-8 w-8 rounded-full bg-[#2ABD41] flex items-center justify-center">
                <Leaf className="h-4 w-4 text-white" />
              </div>
            </Link>
            <Link href="/login"
              className="flex w-full sm:w-auto items-center justify-center gap-3 rounded-full border-2 border-[#DEFAE1] bg-white px-6 py-3 text-[13px] sm:text-[14px] font-bold text-[#072C0E]/70 shadow-sm hover:border-[#2ABD41]/40 hover:text-[#072C0E] transition">
              <Brain className="h-4 w-4 text-[#2ABD41]" />
              <span>{t.hero.demo}</span>
            </Link>
          </div>
        </div>

      </section>

      {/* -- AI Section (like Dinnect AI) -- */}
      <section id="ai" className="relative z-10 py-16 sm:py-28 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">

            {/* Left: Text */}
            <div>
              <h2 className="text-[28px] sm:text-[48px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#072C0E]">
                Carbonless <span className="text-[#2ABD41]">AI</span>
              </h2>
              <p className="mt-4 sm:mt-5 text-[14px] sm:text-[15px] leading-[1.8] text-[#072C0E]/55 max-w-md">
                {lang === 'tr'
                  ? 'Tüm karbon hesaplama ihtiyaçlarınız için tek AI. Emisyon verilerinizi söyleyin, biz hesaplayalım, raporlayalım ve azaltma stratejileri önerelim.'
                  : 'One AI for all your carbon needs. Tell us your emission data  -  we calculate, report, and suggest reduction strategies. Powered by CarbonIQ engine.'}
              </p>

              {/* Feature list */}
              <div className="mt-8 space-y-4">
                {(lang === 'tr' ? [
                  'AI destekli emisyon hesaplama ve sınıflandırma',
                  'ISO 14064-1 uyumlu otomatik rapor oluşturma',
                  'Doğal dil ile veri girişi  -  sadece konuşun',
                  'Saniyeler içinde karbon ayak izi analizi',
                ] : [
                  'AI-driven emission calculation and classification',
                  'ISO 14064-1 compliant automated report generation',
                  'Natural language data entry  -  just talk',
                  'Carbon footprint analysis generated in seconds',
                ]).map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg bg-[#F1FCF2] border border-[#2ABD41]/15 flex items-center justify-center shrink-0">
                      <svg className="h-3.5 w-3.5 text-[#2ABD41]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-[14px] text-[#072C0E]/70 font-medium">{item}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Link href="/register"
                className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#072C0E] px-8 py-3.5 text-[14px] font-bold text-white shadow-lg hover:bg-[#175022] transition hover:-translate-y-0.5">
                {lang === 'tr' ? 'Daha Fazla' : 'Learn More'}
              </Link>
            </div>

            {/* Right: MacBook mockup photo of the actual Carbonless AI chat
                (public/ai-laptop.png) — replaces the old hand-built CSS
                browser-frame mockup. Soft green glow behind it ties it into
                the palette; gentle float + hover lift keep it alive. */}
            <div className="relative flex items-center justify-center">
              <div className="relative w-full max-w-[560px]">
                <div className="absolute inset-8 rounded-full bg-[#2ABD41]/10 blur-3xl" />
                <Image
                  src="/ai-laptop.png"
                  alt={lang === 'tr' ? 'Carbonless AI sohbet ekranı — MacBook üzerinde' : 'Carbonless AI chat on a MacBook'}
                  width={1402}
                  height={1122}
                  className="relative w-full h-auto object-contain drop-shadow-2xl transition-transform duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1"
                  priority={false}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -- Pricing Section -- */}
      <section id="pricing" className="relative z-10 py-16 sm:py-28 bg-[#F1FCF2] border-t border-[#DEFAE1]">
        <div className="mx-auto max-w-4xl px-4 sm:px-8">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-[26px] sm:text-[40px] font-extrabold tracking-[-0.02em] text-[#072C0E]">
              {lang === 'tr' ? 'Basit fiyatlandırma' : 'Simple pricing'}
            </h2>
            <p className="mt-2 sm:mt-3 text-[13px] sm:text-[15px] text-[#072C0E]/50">
              {lang === 'tr' ? 'Her büyüklükteki şirket için uygun planlar.' : 'Plans that fit companies of every size.'}
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 max-w-3xl mx-auto">

            {/* Free Plan */}
            <div className="rounded-2xl border border-[#DEFAE1] bg-white p-5 sm:p-7 shadow-sm">
              <div className="mb-5 sm:mb-6">
                <p className="text-[13px] sm:text-[14px] font-bold text-[#072C0E]/80">{lang === 'tr' ? 'Ücretsiz' : 'Free'}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[30px] sm:text-[36px] font-extrabold text-[#072C0E]">$0</span>
                  <span className="text-[13px] sm:text-[14px] text-[#072C0E]/40">/ {lang === 'tr' ? 'ay' : 'month'}</span>
                </div>
                <p className="mt-2 text-[12px] sm:text-[13px] text-[#072C0E]/50">
                  {lang === 'tr' ? 'Küçük ekipler için temel karbon hesaplama.' : 'Basic carbon calculation for small teams.'}
                </p>
              </div>
              <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
                {(lang === 'tr' ? [
                  'Dashboard veri girişi',
                  'Temel emisyon hesaplama',
                  'Sektör benchmarkı',
                  'Aylık 5 AI soru',
                ] : [
                  'Dashboard data entry',
                  'Basic emission calculations',
                  'Sector benchmark',
                  '5 AI questions / month',
                ]).map(f => (
                  <div key={f} className="flex items-center gap-2.5">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#2ABD41] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[12px] sm:text-[13px] text-[#072C0E]/65">{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/register"
                className="block w-full rounded-full border-2 border-[#DEFAE1] py-2.5 sm:py-3 text-center text-[12px] sm:text-[13px] font-bold text-[#072C0E]/60 hover:border-[#072C0E]/30 hover:text-[#072C0E] transition">
                {lang === 'tr' ? 'Ücretsiz Başla' : 'Get Started'}
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="relative rounded-2xl border-2 border-[#2ABD41] bg-white p-5 sm:p-7 shadow-lg shadow-[#2ABD41]/5">
              {/* Popular badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2ABD41] px-4 py-1 text-[10px] font-bold text-white uppercase tracking-wide">
                {lang === 'tr' ? 'Popüler' : 'Popular'}
              </div>
              <div className="mb-5 sm:mb-6">
                <p className="text-[13px] sm:text-[14px] font-bold text-[#2ABD41]">Pro</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-[30px] sm:text-[36px] font-extrabold text-[#072C0E]">$49</span>
                  <span className="text-[13px] sm:text-[14px] text-[#072C0E]/40">/ {lang === 'tr' ? 'ay' : 'month'}</span>
                </div>
                <p className="mt-2 text-[12px] sm:text-[13px] text-[#072C0E]/50">
                  {lang === 'tr' ? 'AI destekli tam karbon yönetim platformu.' : 'Full AI-powered carbon management platform.'}
                </p>
              </div>
              <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
                {(lang === 'tr' ? [
                  'Ücretsiz\'deki her şey',
                  'Sınırsız AI karbon hesaplama',
                  'ISO 14064-1 PDF raporu',
                  'Hedefler ve ilerleme takibi',
                  'AI rehberli anket (133 soru)',
                  'Danışman onay sistemi',
                  'Excel/CSV dışa aktarma',
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
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#2ABD41] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[12px] sm:text-[13px] text-[#072C0E]/65">{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/register"
                className="block w-full rounded-full bg-[#2ABD41] py-2.5 sm:py-3 text-center text-[12px] sm:text-[13px] font-bold text-white shadow-sm hover:bg-[#1D9C31] transition">
                {lang === 'tr' ? 'Pro\'ya Geç' : 'Go Pro'}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -- Footer strip -- */}
      <footer className="relative z-10 border-t border-[#DEFAE1] bg-white/80 backdrop-blur-sm py-4 sm:py-5">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <Image src="/carbonless.png" alt="Carbonless" width={16} height={16} className="h-4 w-4 object-contain" />
            <span className="text-[11px] sm:text-[12px] font-medium text-[#072C0E]/40">&copy; 2025 Carbonless. All rights reserved.</span>
          </div>
          <div className="flex gap-4">
            <Link href="/terms" className="text-[11px] sm:text-[12px] text-[#072C0E]/40 hover:text-[#072C0E]/70 transition">
              {lang === 'tr' ? 'Kullanım Koşulları' : 'Terms'}
            </Link>
            <Link href="/privacy" className="text-[11px] sm:text-[12px] text-[#072C0E]/40 hover:text-[#072C0E]/70 transition">
              {lang === 'tr' ? 'Gizlilik' : 'Privacy'}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
