'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Globe2, Leaf, Brain, Sparkles, BarChart3, Zap, TreePine, Factory, CloudSun, Wind, Flame, Droplets, Linkedin, Instagram, Youtube, Truck, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Header from '@/components/Header';

/* -- Copy -- */
const copy = {
  en: {
    nav: { home: 'Home', about: 'About', features: 'Features', ai: 'AI', login: 'Login' },
    hero: {
      kicker: 'AI Precision. Carbon Vision.',
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
      kicker: 'Yapay Zeka Hassasiyeti. Karbon Vizyonu.',
      line1: 'AI destekli',
      highlight: 'karbon hesaplama',
      line2: 'platformunuz.',
      desc: '',
      cta: 'Ücretsiz Başlayın',
      demo: 'Demo Talep Et',
    },
  },
};

/* -- Hero pixel-mosaic backdrop (light Droneland-style, brand greens) --
   Tile colors/pulses are generated with a seeded PRNG at module scope so the
   server and client render identical markup (no hydration mismatch). */
const MOSAIC_COLS = 24;
const MOSAIC_ROWS = 9;
const mosaicTiles = (() => {
  let s = 42;
  const rand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  // Light greens on the hero cream — duplicates of the base color act as gaps
  const palette = ['#F9FFF4', '#F9FFF4', '#F2FAE8', '#E9F5D9', '#DEF0C6', '#D1E9B2', '#C3E19E'];
  return Array.from({ length: MOSAIC_COLS * MOSAIC_ROWS }, () => ({
    color: palette[Math.floor(rand() * palette.length)],
    pulse: rand() < 0.2,
    delay: +(rand() * 6).toFixed(2),
    duration: +(4 + rand() * 5).toFixed(2),
  }));
})();

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
        <span className="block rounded-full border border-[#DEFAE1] bg-white/90 px-2 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-[#1A7B2A] shadow-sm backdrop-blur-sm transition-all duration-300 group-hover:border-[#2ABD41] group-hover:bg-[#2ABD41] group-hover:text-white">
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

/* -- Connection lines SVG (desktop/tablet) -- */
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

/* -- Connection lines SVG (phone) --
   The desktop version above is hand-placed for a 1200x700 landscape
   viewBox matching the 12-node desktop layout — on a narrow portrait
   phone that box gets letterboxed and the lines land nowhere near the
   actual mobile nodes (different count, different positions entirely).
   This uses a 0-100 percentage viewBox with preserveAspectRatio="none"
   so coordinates stretch exactly the same way the Tailwind top/left/
   right percentage classes position the nodes themselves — endpoints
   line up with the real node centers at any phone width/height.
   vector-effect="non-scaling-stroke" keeps the line weight consistent
   despite the non-uniform (x != y) scaling that requires. */
function ConnectionLinesMobile() {
  const S = { stroke: '#2ABD41', vectorEffect: 'non-scaling-stroke' };
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.14]" viewBox="0 0 100 100" preserveAspectRatio="none">
      {/* top band: Scope 1 -> Scope 2 (left chain), AI Engine -> Smart Report (right chain) */}
      <line x1="11" y1="10" x2="16" y2="22" strokeWidth="1" {...S} />
      <line x1="89" y1="10" x2="84" y2="22" strokeWidth="1" {...S} />
      {/* bottom band: Scope 3 -> Net Zero (left chain), ISO 14064 -> ESG (right chain) */}
      <line x1="16" y1="78" x2="11" y2="90" strokeWidth="1" {...S} />
      <line x1="84" y1="78" x2="89" y2="90" strokeWidth="1" {...S} />
      {/* long verticals threading each side's 4 nodes into one visible chain */}
      <line x1="16" y1="22" x2="16" y2="78" strokeWidth="0.6" {...S} />
      <line x1="84" y1="22" x2="84" y2="78" strokeWidth="0.6" {...S} />
      {/* cross-diagonals for the same "network" feel as the desktop version */}
      <line x1="11" y1="10" x2="84" y2="78" strokeWidth="0.4" {...S} />
      <line x1="89" y1="10" x2="16" y2="78" strokeWidth="0.4" {...S} />
    </svg>
  );
}

/* -- Page -- */
export default function Home() {
  const { language: lang } = useLanguage();

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
        @keyframes mosaicPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
        .animate-mosaic {
          animation: mosaicPulse 6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-mosaic, .animate-float { animation: none; }
        }
      `}} />

      <Header />

      {/* -- Hero Section — 4 corner images + centered text -- */}
      <section className="relative pt-28 sm:pt-36 pb-16 sm:pb-24 bg-white min-h-[80vh] flex items-center">
        {/* Corner images — animated float + click for scope info */}
        {[
          { src: '/hero-corner1.png', pos: 'top-0 left-0', size: 'w-[30%] sm:w-[22%]', delay: '0s', label: 'Scope 1', desc: lang === 'tr' ? 'Doğrudan emisyonlar — tesisler, araçlar, yakıt yanması' : 'Direct emissions — facilities, vehicles, fuel combustion', tipPos: 'left-full top-1/2 -translate-y-1/2 ml-2' },
          { src: '/hero-corner2.png', pos: 'top-0 right-0', size: 'w-[25%] sm:w-[18%]', delay: '1s', label: '', desc: '', tipPos: '' },
          { src: '/hero-corner3.png', pos: 'bottom-0 left-0', size: 'w-[28%] sm:w-[20%]', delay: '2s', label: 'Scope 2', desc: lang === 'tr' ? 'Satın alınan enerji — elektrik, ısı, buhar' : 'Purchased energy — electricity, heat, steam', tipPos: 'left-full top-1/2 -translate-y-1/2 ml-2' },
          { src: '/hero-corner4.png', pos: 'bottom-0 right-0', size: 'w-[30%] sm:w-[22%]', delay: '0.5s', label: 'Scope 3', desc: lang === 'tr' ? 'Dolaylı emisyonlar — tedarik zinciri, iş seyahati, atık' : 'Indirect emissions — supply chain, business travel, waste', tipPos: 'right-full top-1/2 -translate-y-1/2 mr-2' },
        ].map((corner, i) => (
          <div key={i} className={`absolute ${corner.pos} ${corner.size} animate-float group cursor-pointer z-10`} style={{ animationDelay: corner.delay }}
            onClick={(e) => {
              if (!corner.label) return;
              const tip = e.currentTarget.querySelector('[data-tip]');
              if (tip) { tip.classList.toggle('opacity-0'); tip.classList.toggle('opacity-100'); }
            }}
          >
            <img src={corner.src} alt={corner.label} className="w-full h-auto object-contain transition-transform duration-300 group-hover:scale-105 active:scale-95" />
            {corner.label && (
              <div data-tip className={`absolute ${corner.tipPos} opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 max-w-[200px] sm:max-w-none`}>
                <div className="rounded-xl bg-[#072C0E] px-3 py-2 sm:px-4 sm:py-2.5 text-center shadow-xl">
                  <p className="text-[11px] sm:text-[12px] font-bold text-[#2ABD41]">{corner.label}</p>
                  <p className="text-[10px] sm:text-[11px] text-white/80 mt-0.5 whitespace-normal">{corner.desc}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Center content */}
        <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-8 text-center">
          <p className="mb-3 sm:mb-4 text-[11px] sm:text-[13px] font-bold uppercase tracking-[0.25em] text-[#2ABD41]">
            {t.hero.kicker}
          </p>
          <h1 className="text-[28px] sm:text-[44px] lg:text-[60px] font-black leading-[1.1] tracking-[-0.045em] text-[#072C0E]">
            {t.hero.line1}{' '}
            <span className="text-[#2ABD41]">{t.hero.highlight}</span>{' '}
            {t.hero.line2}
          </h1>
          <p className="mt-5 sm:mt-6 text-[14px] sm:text-[16px] leading-[1.8] text-[#072C0E]/60 max-w-2xl mx-auto">
            {lang === 'tr'
              ? 'Carbonless AI, karbon yoğun aktivitelerinizin etkisini gerçek zamanlı hesaplar ve ISO 14064-1 uyumlu raporlar oluşturur.'
              : 'Carbonless AI calculates the impact of your carbon-intensive activities in real time and generates ISO 14064-1 compliant reports.'}
          </p>
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/register"
              className="flex items-center justify-center gap-2 rounded-full bg-[#2ABD41] px-8 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-[#2ABD41]/25 hover:bg-[#1D9C31] transition hover:-translate-y-0.5">
              {lang === 'tr' ? 'Hesaplamaya Başla' : 'Start Calculating'}
            </Link>
            <a href="#ai"
              className="flex items-center justify-center gap-2 rounded-full bg-[#072C0E] px-8 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-black/15 hover:bg-[#175022] transition hover:-translate-y-0.5">
              {lang === 'tr' ? 'Nasıl Çalışır?' : 'See How It Works'}
            </a>
          </div>
        </div>
      </section>


      <section id="about" className="relative z-10 py-12 sm:py-20 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* Left: heading + story */}
            <div>
              <h2 className="text-[34px] sm:text-[56px] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#072C0E]">
                {lang === 'tr' ? <>Biz <span className="text-[#2ABD41]">Kimiz?</span></> : <>About <span className="text-[#2ABD41]">Us</span></>}
              </h2>

              <div className="mt-6 sm:mt-8 space-y-4 text-[14px] sm:text-[15px] leading-[1.8] text-[#072C0E]/65 max-w-lg">
                <p>
                  {lang === 'tr'
                    ? 'Çoğu şirket karbon ayak izini hâlâ dağınık tablolarda takip ediyor — ya da pahalı danışmanlara devredip raporu haftalarca bekliyor.'
                    : 'Most companies still track their carbon footprint in scattered spreadsheets — or hand it to expensive consultants and wait weeks for a report.'}
                </p>
                <p>
                  {lang === 'tr'
                    ? <>Oysa müşteriler, bankalar ve regülasyonlar aynı soruyu soruyor: ayak iziniz ne? Gerçek rakamlarla cevap verebilen şirketler kazanıyor. <strong className="text-[#072C0E] font-bold">Gerçek veri, gerçek değişim yaratır.</strong></>
                    : <>Meanwhile customers, banks and regulators are all asking the same question: what&apos;s your footprint? The companies that can answer with real numbers win. <strong className="text-[#072C0E] font-bold">Real data creates real change.</strong></>}
                </p>
                <p>
                  {lang === 'tr'
                    ? "Carbonless bu cevabı anında verir. Verinizi AI'a kendi cümlelerinizle anlatın — 188+ emisyon faktörüyle Kapsam 1, 2 ve 3 emisyonlarınızı hesaplar, denetime hazır ISO 14064-1 raporunuzu oluşturur."
                    : "Carbonless makes that answer instant. Tell your data to the AI in plain language — it calculates your Scope 1, 2 & 3 emissions with 188+ emission factors and builds audit-ready ISO 14064-1 reports."}
                </p>
                <p>
                  {lang === 'tr' ? 'Misyonumuz: ' : 'Our mission: '}
                  <strong className="font-bold text-[#2ABD41]">
                    {lang === 'tr' ? 'Karbon Muhasebesini Basitleştirmek.' : 'Make Carbon Accounting Simple.'}
                  </strong>
                </p>
                <p>
                  {lang === 'tr'
                    ? 'Tablo yok. Bekleme yok. Sadece net rakamlar, akıllı içgörüler ve doğrudan denetçiye verebileceğiniz raporlar.'
                    : 'No spreadsheets. No waiting. Just clear numbers, smart insights, and reports you can hand straight to an auditor.'}
                </p>
              </div>
            </div>

            {/* Right: showcase card (Dinnect sample) — bold vertical green
                stripe with the phone mockup photo overlapping it; playful
                typography sits lower-left on white, clear of the stripe. */}
            <div className="relative">
              <div className="relative overflow-hidden rounded-[2rem] bg-white border border-[#DEFAE1] shadow-[0_20px_60px_rgba(7,44,14,0.10)] px-6 sm:px-10 pt-8 sm:pt-10 pb-6 sm:pb-8">
                {/* bold vertical stripe running behind the phone */}
                <div className="absolute top-0 bottom-24 right-[14%] w-24 sm:w-36 bg-[#2ABD41] rounded-b-[2rem]" />

                {/* phone mockup photo overlapping the stripe — carousel on click */}
                <div className="relative flex justify-end ml-auto w-[55%] cursor-pointer select-none"
                  onClick={() => {
                    const imgs = ['/about-phone.png', '/about-phone2.png', '/about-phone3.png', '/about-phone4.png'];
                    const el = document.getElementById('about-phone-img');
                    if (!el) return;
                    const curr = parseInt(el.dataset.idx || '0', 10);
                    const next = (curr + 1) % imgs.length;
                    el.src = imgs[next];
                    el.dataset.idx = next;
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    id="about-phone-img"
                    data-idx="0"
                    src="/about-phone.png"
                    alt={lang === 'tr' ? 'Karbon ayak izi — telefonda' : 'Carbon footprint on a phone'}
                    className="h-80 sm:h-[440px] w-44 sm:w-[220px] object-cover rounded-[2rem] drop-shadow-2xl animate-float rotate-[6deg] transition-all duration-300"
                  />
                </div>

                {/* playful mixed-tone typography — pulled up beside the
                    phone's lower half, constrained left so the green line
                    stays on white (never green-on-green over the stripe) */}
                <div className="relative z-10 -mt-24 sm:-mt-40 max-w-[58%]">
                  <p className="text-[30px] sm:text-[44px] font-extrabold leading-none tracking-tight text-[#072C0E]/30">Hey!</p>
                  <p className="mt-1 text-[22px] sm:text-[30px] font-bold leading-tight tracking-tight text-[#072C0E]/45">
                    {lang === 'tr' ? 'Bugünkü' : "What's your"}
                  </p>
                  <p className="text-[30px] sm:text-[42px] font-extrabold leading-tight tracking-[-0.02em] text-[#2ABD41]">
                    {lang === 'tr' ? 'ayak izin ne?' : 'footprint today?'}
                  </p>
                </div>

                {/* caption */}
                <p className="relative mt-8 sm:mt-10 text-center text-[13px] sm:text-[14px] font-medium text-[#072C0E]/40">
                  {lang === 'tr' ? 'Önemli olanı ölçelim' : "Let's measure what matters"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* -- AI Section (like Dinnect AI) -- */}
      <section id="ai" className="relative z-10 py-12 sm:py-20 bg-white">
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

      {/* white → cream blend before How it Works */}
      <div aria-hidden className="h-8 sm:h-10 bg-gradient-to-b from-white to-[#F9FFF4]" />

      {/* -- How it Works — 4-step process, numbered circles on a shared
          connector line (desktop only; the line has nothing meaningful to
          span once the steps stack into one column on mobile). -- */}
      <section id="how-it-works" className="relative z-10 py-12 sm:py-20 bg-[#F9FFF4]">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-[26px] sm:text-[40px] font-extrabold tracking-[-0.02em] text-[#072C0E]">
              {lang === 'tr' ? 'Nasıl çalışır?' : 'How it works'}
            </h2>
            <p className="mt-2 sm:mt-3 text-[13px] sm:text-[15px] text-[#072C0E]/50">
              {lang === 'tr' ? 'Dört adımda, dakikalar içinde denetime hazır raporunuz.' : 'Four steps to an audit-ready report, in minutes.'}
            </p>
          </div>

          {/* Plain numbered circles — same treatment as the dashboard's own
              "How it Works" guide, replacing the previous per-step spinning/
              pulsing icon animations for a calmer, more consistent brand feel. */}
          <div className="rounded-2xl border border-[#DEFAE1] bg-white p-5 sm:p-8">
            <div className="relative grid gap-8 sm:grid-cols-4 sm:gap-6">
              <div aria-hidden className="hidden sm:block absolute left-[12.5%] right-[12.5%] top-6 h-px bg-[#DEFAE1]" />

              {[
                {
                  num: '1',
                  title: lang === 'tr' ? 'Verinizi anlatın' : 'Tell the AI',
                  desc: lang === 'tr' ? 'Enerji, seyahat ya da satın alımlarınızı sade bir dille anlatın — tablo yok.' : 'Describe your energy use, travel, or purchases in plain language — no spreadsheets.',
                },
                {
                  num: '2',
                  title: lang === 'tr' ? 'AI hesaplar' : 'AI calculates',
                  desc: lang === 'tr' ? "CarbonIQ, verinizi 188+ emisyon faktörüyle anında eşleştirir." : 'CarbonIQ matches your data against 188+ emission factors instantly.',
                },
                {
                  num: '3',
                  title: lang === 'tr' ? 'Raporunuzu alın' : 'Get your report',
                  desc: lang === 'tr' ? 'Saniyeler içinde ISO 14064-1 uyumlu, denetime hazır PDF raporu.' : 'An ISO 14064-1 compliant, audit-ready PDF report in seconds.',
                },
                {
                  num: '4',
                  title: lang === 'tr' ? 'Hedef belirleyin' : 'Track & reduce',
                  desc: lang === 'tr' ? 'Hedefler koyun, ilerlemenizi izleyin, ayak izinizi zamanla küçültün.' : 'Set targets, track progress, and watch your footprint shrink over time.',
                },
              ].map((step) => (
                <div key={step.num} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white border-2 border-[#2ABD41] text-[15px] font-bold text-[#2ABD41] shadow-sm">
                    {step.num}
                  </div>
                  <h3 className="mt-3 text-[15px] sm:text-[16px] font-bold text-[#072C0E]">{step.title}</h3>
                  <p className="mt-2 text-[13px] leading-[1.7] text-[#072C0E]/55 max-w-[220px]">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* cream → white blend before Pricing (Pricing's own gradient continues from white) */}
      <div aria-hidden className="h-8 sm:h-10 bg-gradient-to-b from-[#F9FFF4] to-white" />

      {/* -- Pricing Section — fades in from the white AI section above
             (gradient over the top padding) instead of a hard border cut -- */}
      <section id="pricing" className="relative z-10 py-12 sm:py-20 bg-gradient-to-b from-white via-[#F1FCF2] to-[#F1FCF2]">
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

      {/* pale mint → white blend before FAQ */}
      <div aria-hidden className="h-8 sm:h-10 bg-gradient-to-b from-[#F1FCF2] to-white" />

      {/* -- FAQ — native <details>/<summary> so the accordion needs no JS
          state and stays accessible/keyboard-friendly for free. -- */}
      <section id="faq" className="relative z-10 py-12 sm:py-20 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-[26px] sm:text-[40px] font-extrabold tracking-[-0.02em] text-[#072C0E]">
              {lang === 'tr' ? 'Sıkça sorulan sorular' : 'Frequently asked questions'}
            </h2>
            <p className="mt-2 sm:mt-3 text-[13px] sm:text-[15px] text-[#072C0E]/50">
              {lang === 'tr' ? 'Başka bir sorunuz mu var? Bize ulaşın.' : "Still have questions? We're happy to help."}
            </p>
          </div>

          <div className="space-y-3">
            {(lang === 'tr' ? [
              { q: 'Kapsam 1, 2 ve 3 emisyonları nedir?', a: 'Kapsam 1 doğrudan emisyonlarınızdır (kendi tesisleriniz, araçlarınız). Kapsam 2, satın aldığınız elektrik/ısıdan kaynaklanır. Kapsam 3 ise tedarik zinciriniz, iş seyahatleri ve ürün kullanımı gibi dolaylı emisyonları kapsar.' },
              { q: 'Kullanmak için teknik bilgi gerekiyor mu?', a: "Hayır. Verilerinizi kendi cümlelerinizle AI'a anlatmanız yeterli — CarbonIQ geri kalanını hesaplar ve sınıflandırır." },
              { q: 'Raporlar gerçekten denetime hazır mı?', a: 'Evet. Tüm Pro raporları ISO 14064-1 standardına uygun hazırlanır ve doğrudan denetçinize teslim edilebilir.' },
              { q: 'İstediğim zaman iptal edebilir miyim?', a: 'Evet, Pro aboneliğinizi istediğiniz zaman iptal edebilir veya Ücretsiz plana geri dönebilirsiniz — taahhüt yok.' },
              { q: 'Verilerim güvende mi?', a: 'Tüm veriler şifrelenir ve yalnızca sizin şirketiniz erişebilir. Verilerinizi asla üçüncü taraflarla paylaşmayız.' },
            ] : [
              { q: 'What are Scope 1, 2, and 3 emissions?', a: 'Scope 1 covers your direct emissions (owned facilities, vehicles). Scope 2 comes from the electricity or heat you purchase. Scope 3 covers indirect emissions across your supply chain, business travel, and product use.' },
              { q: 'Do I need technical knowledge to use Carbonless?', a: 'No. Just describe your data to the AI in plain language — CarbonIQ handles the calculation and classification for you.' },
              { q: 'Are the reports really audit-ready?', a: 'Yes. Every Pro report is built to the ISO 14064-1 standard and can be handed straight to your auditor.' },
              { q: 'Can I cancel anytime?', a: 'Yes, you can cancel your Pro subscription or downgrade to Free at any time — no contracts.' },
              { q: 'Is my data secure?', a: 'All data is encrypted and accessible only to your company. We never share your data with third parties.' },
            ]).map((item, i) => (
              <details key={i} className="group rounded-2xl border border-[#DEFAE1] bg-[#F9FFF4] px-5 sm:px-6 open:bg-white open:shadow-md transition-colors">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[14px] sm:text-[15px] font-bold text-[#072C0E] [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <svg className="h-4 w-4 shrink-0 text-[#2ABD41] transition-transform duration-300 group-open:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </summary>
                <p className="pb-4 sm:pb-5 text-[13px] sm:text-[14px] leading-[1.8] text-[#072C0E]/60">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* white → dark-green blend before the Footer — the biggest color jump
          on the page, so it gets more height + more eased stops than the
          other transitions to avoid a visible seam. */}
      <div aria-hidden className="h-px bg-[#e5e5e5]" />

      {/* -- Footer — Dinnect-style multi-column, in brand dark green -- */}
      <footer className="relative z-10 bg-[#111111] text-white/85">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 pt-12 sm:pt-16 pb-6 sm:pb-8">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-5 md:gap-8">

            {/* Brand + tagline + socials */}
            <div className="col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
                  <Image src="/carbonless.png" alt="Carbonless" width={22} height={22} className="h-[22px] w-[22px] object-contain" />
                </div>
                <span className="text-[20px] font-extrabold tracking-tight">Carbonless</span>
              </div>
              <p className="mt-5 max-w-xs text-[13px] sm:text-[14px] leading-[1.8] text-white/55">
                {lang === 'tr'
                  ? 'Karbon ayak izinizi AI ile hesaplayın, ISO 14064-1 uyumlu raporlar oluşturun. Karbon muhasebesi, yeniden tasarlandı.'
                  : 'Calculate your carbon footprint with AI and generate ISO 14064-1 compliant reports. Carbon accounting, reimagined.'}
              </p>
              <div className="mt-6 flex gap-3">
                {[
                  { icon: X, label: 'X (Twitter)' },
                  { icon: Linkedin, label: 'LinkedIn' },
                  { icon: Instagram, label: 'Instagram' },
                  { icon: Youtube, label: 'YouTube' },
                ].map(({ icon: Icon, label }) => (
                  <a key={label} href="#" aria-label={label}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 border border-white/10 text-white/60 transition hover:bg-[#2ABD41] hover:border-[#2ABD41] hover:text-white">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </a>
                ))}
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
                {lang === 'tr' ? 'Ürün' : 'Product'}
              </h4>
              <ul className="mt-5 space-y-3.5 text-[13px] sm:text-[14px]">
                <li><a href="#ai" className="text-white/75 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'CarbonIQ AI' : 'CarbonIQ AI'}</a></li>
                <li><a href="#pricing" className="text-white/75 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Fiyatlandırma' : 'Pricing'}</a></li>
                <li><Link href="/register" className="text-white/75 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Ücretsiz Başlayın' : 'Get Started Free'}</Link></li>
                <li className="flex items-center gap-2">
                  <span className="text-white/40">{lang === 'tr' ? 'Mobil Uygulama' : 'Mobile App'}</span>
                  <span className="rounded-full bg-[#2ABD41]/15 px-2 py-0.5 text-[10px] font-bold text-[#2ABD41]">
                    {lang === 'tr' ? 'Yakında' : 'Soon'}
                  </span>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
                {lang === 'tr' ? 'Şirket' : 'Company'}
              </h4>
              <ul className="mt-5 space-y-3.5 text-[13px] sm:text-[14px]">
                <li><a href="#about" className="text-white/75 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Hakkımızda' : 'About Us'}</a></li>
                <li><Link href="/login" className="text-white/75 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Giriş' : 'Login'}</Link></li>
                <li><Link href="/register" className="text-white/75 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Hesap Oluştur' : 'Create Account'}</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
                {lang === 'tr' ? 'Yasal' : 'Legal'}
              </h4>
              <ul className="mt-5 space-y-3.5 text-[13px] sm:text-[14px]">
                <li><Link href="/privacy" className="text-white/75 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}</Link></li>
                <li><Link href="/terms" className="text-white/75 transition hover:text-[#2ABD41]">{lang === 'tr' ? 'Kullanım Koşulları' : 'Terms of Service'}</Link></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 sm:mt-16 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 sm:pt-6 sm:flex-row">
            <span className="text-[11px] sm:text-[12px] text-white/40">&copy; 2026 Carbonless. All rights reserved.</span>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-[11px] sm:text-[12px] text-white/40 transition hover:text-white/80">
                {lang === 'tr' ? 'Gizlilik' : 'Privacy Policy'}
              </Link>
              <Link href="/terms" className="text-[11px] sm:text-[12px] text-white/40 transition hover:text-white/80">
                {lang === 'tr' ? 'Kullanım Koşulları' : 'Terms of Service'}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
