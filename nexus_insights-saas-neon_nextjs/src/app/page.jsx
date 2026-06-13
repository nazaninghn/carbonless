'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Globe2, Leaf, Sparkles, CheckCircle2, BarChart3, FileText } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// ── Demo conversation ──────────────────────────────────────────────────────────
const DEMO_MSGS = [
  {
    role: 'ai',
    tr: 'Merhaba! Geçen yılki enerji tüketim verilerinizi paylaşır mısınız?',
    en: 'Hi! Can you share your energy consumption data from last year?',
  },
  {
    role: 'user',
    tr: 'Geçen yıl 15.000 m³ doğalgaz kullandık, merkez ofiste.',
    en: 'We used 15,000 m³ natural gas last year at our head office.',
  },
  {
    role: 'card',
    scope: 1,
    scopeTr: 'Kapsam 1', scopeEn: 'Scope 1',
    catTr: 'Sabit Yanma', catEn: 'Stationary Combustion',
    value: '30,3',
    detailTr: 'Doğalgaz · 15.000 m³ · DEFRA 2023',
    detailEn: 'Natural gas · 15,000 m³ · DEFRA 2023',
    bg: 'bg-orange-50', border: 'border-orange-200/60',
    badge: 'bg-orange-50 text-orange-600 border-orange-200',
    val: 'text-orange-600',
  },
  {
    role: 'ai',
    tr: 'Harika! Elektrik tüketiminiz var mıydı?',
    en: 'Great! Did you have any electricity consumption?',
  },
  {
    role: 'user',
    tr: 'Evet, 18.000 kWh aldık TEDAŞ\'tan.',
    en: 'Yes, we bought 18,000 kWh from the national grid.',
  },
  {
    role: 'card',
    scope: 2,
    scopeTr: 'Kapsam 2', scopeEn: 'Scope 2',
    catTr: 'Satın Alınan Elektrik', catEn: 'Purchased Electricity',
    value: '7,9',
    detailTr: 'Şebeke · 18.000 kWh · IEA 2023',
    detailEn: 'Grid · 18,000 kWh · IEA 2023',
    bg: 'bg-yellow-50', border: 'border-yellow-200/60',
    badge: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    val: 'text-yellow-700',
  },
];

// When each message should appear (ms from start)
const TIMINGS = [300, 2400, 5000, 7800, 9800, 12400];
const TYPING_BEFORE = 900; // show typing dots this many ms before AI/card

function TypingDots() {
  return (
    <div className="flex gap-1 px-1 py-0.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[#B4BE6A] animate-bounce"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </div>
  );
}

function AnimatedChatDemo({ lang }) {
  const tr = lang === 'tr';
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const timers = [];
    setShown(0);
    setTyping(false);

    TIMINGS.forEach((t, i) => {
      const msg = DEMO_MSGS[i];
      // Show typing indicator before AI messages and cards
      if (msg.role === 'ai' || msg.role === 'card') {
        timers.push(setTimeout(() => setTyping(true), t - TYPING_BEFORE));
      }
      timers.push(setTimeout(() => {
        setTyping(false);
        setShown(i + 1);
      }, t));
    });

    // Restart loop after a pause
    timers.push(setTimeout(() => {
      setShown(0);
      setTyping(false);
    }, 17500));

    return () => timers.forEach(clearTimeout);
  }, [lang]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [shown, typing]);

  const msgs = DEMO_MSGS.slice(0, shown);

  return (
    <div className="relative rounded-2xl border border-[#302817]/10 bg-white shadow-2xl shadow-[#302817]/10 overflow-hidden select-none">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#302817]/6 bg-[#FAFAF8]">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-1.5 rounded-full bg-[#302817]/5 px-3 py-1">
            <Sparkles className="h-3 w-3 text-[#B4BE6A]" />
            <span className="text-[10px] font-bold text-[#302817]/50">CarbonIQ AI Asistan</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#95A847] animate-pulse ml-0.5" />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="h-[340px] overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
        {msgs.map((msg, i) => {
          if (msg.role === 'ai') {
            return (
              <div key={i} className="flex gap-2">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#302817]">
                  <Sparkles className="h-3 w-3 text-[#B4BE6A]" />
                </div>
                <div className="max-w-[82%] rounded-[15px] rounded-tl-sm border border-[#302817]/8 bg-white px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#302817] shadow-sm">
                  {tr ? msg.tr : msg.en}
                </div>
              </div>
            );
          }
          if (msg.role === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[78%] rounded-[15px] rounded-tr-sm bg-[#302817] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-white">
                  {tr ? msg.tr : msg.en}
                </div>
              </div>
            );
          }
          if (msg.role === 'card') {
            return (
              <div key={i} className={`rounded-xl border ${msg.border} ${msg.bg} p-3`}>
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div>
                    <span className={`text-[9px] font-bold uppercase border rounded-full px-1.5 py-0.5 ${msg.badge}`}>
                      {tr ? msg.scopeTr : msg.scopeEn}
                    </span>
                    <p className="text-[12.5px] font-bold text-[#302817] mt-1">
                      {tr ? msg.catTr : msg.catEn}
                    </p>
                    <p className="text-[10px] text-[#302817]/40 mt-0.5">
                      {tr ? msg.detailTr : msg.detailEn}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-[22px] font-bold leading-none ${msg.val}`}>{msg.value}</p>
                    <p className="text-[10px] text-[#302817]/35 mt-0.5">tCO₂e</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-lg bg-[#302817] py-1.5 text-center text-[10.5px] font-bold text-white">
                    {tr ? '✓ Onayla & Kaydet' : '✓ Confirm & Save'}
                  </div>
                  <div className="rounded-lg border border-[#302817]/15 px-3 py-1.5 text-[10.5px] font-semibold text-[#302817]/45">
                    {tr ? 'Düzenle' : 'Edit'}
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })}

        {/* Typing indicator */}
        {typing && (
          <div className="flex gap-2">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#302817]">
              <Sparkles className="h-3 w-3 text-[#B4BE6A]" />
            </div>
            <div className="rounded-[15px] rounded-tl-sm border border-[#302817]/8 bg-white px-3.5 py-3 shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      {/* Fake input bar */}
      <div className="border-t border-[#302817]/6 bg-white px-3 py-2.5 flex gap-2 items-center">
        <div className="flex-1 rounded-xl border border-[#302817]/8 bg-[#FAFAF8] px-3 py-2 text-[11px] text-[#302817]/25">
          {tr ? 'Verilerinizi yazın…' : 'Type your emission data…'}
        </div>
        <div className="h-8 w-8 rounded-full bg-[#302817] flex items-center justify-center opacity-35">
          <ArrowRight className="h-3.5 w-3.5 text-white" />
        </div>
      </div>
    </div>
  );
}

// ── Copy ───────────────────────────────────────────────────────────────────────
const copy = {
  en: {
    login:    'Login',
    register: 'Get Started Free',
    badge:    'AI CARBON ASSISTANT',
    title1:   'Stop filling forms.',
    title2:   'Talk to AI.',
    title3:   'Get your carbon report.',
    desc:     'CarbonIQ turns your natural language into ISO 14064-1 compliant emission reports. Just describe your activities — the AI extracts, calculates and reports.',
    start:    'Start Talking to AI',
    demo:     'View Dashboard',
    feat1t:   'Natural Language',
    feat1d:   'Say "we used 15,000 m³ gas" — no forms, no spreadsheets',
    feat2t:   'Instant Calculation',
    feat2d:   'DEFRA 2023 · IEA 2023 · GLEC v3 emission factors, live',
    feat3t:   'ISO 14064-1 Report',
    feat3d:   'Scope 1, 2, 3 breakdown. Audit-ready from day one.',
    how:      'How it works',
    s1t: 'Just talk',         s1d: 'Tell the AI what energy and transport activities you had last year',
    s2t: 'AI extracts',       s2d: 'It identifies emission sources, calculates CO₂e and shows a review card',
    s3t: 'You confirm',       s3d: 'Review, edit if needed, confirm — data is saved to your workspace',
    s4t: 'Switch anytime',    s4d: 'Go to the structured panel, edit manually, come back to chat — always in sync',
    ctaTitle: 'Your carbon footprint is a conversation away.',
    ctaDesc:  'No training needed. No consultants. Just talk.',
    ctaBtn:   'Start Free',
  },
  tr: {
    login:    'Giriş',
    register: 'Ücretsiz Başla',
    badge:    'AI KARBON ASISTANI',
    title1:   'Form doldurmaya son.',
    title2:   'AI ile konuşun.',
    title3:   'Karbon raporunuzu alın.',
    desc:     'CarbonIQ, doğal dilinizi ISO 14064-1 uyumlu emisyon raporlarına dönüştürür. Faaliyetlerinizi anlatın — AI çıkarır, hesaplar ve raporlar.',
    start:    'AI ile Konuşmaya Başla',
    demo:     'Paneli Gör',
    feat1t:   'Doğal Dil',
    feat1d:   '"15.000 m³ gaz kullandık" deyin — form yok, Excel yok',
    feat2t:   'Anında Hesaplama',
    feat2d:   'DEFRA 2023 · IEA 2023 · GLEC v3 emisyon faktörleri, canlı',
    feat3t:   'ISO 14064-1 Rapor',
    feat3d:   'Kapsam 1, 2, 3 dökümü. İlk günden denetim hazır.',
    how:      'Nasıl Çalışır?',
    s1t: 'Sadece konuşun',    s1d: 'Geçen yıl hangi enerji ve taşıma faaliyetleriniz olduğunu AI\'ya anlatın',
    s2t: 'AI çıkarır',        s2d: 'Emisyon kaynaklarını tespit eder, CO₂e hesaplar ve onay kartı gösterir',
    s3t: 'Siz onaylarsınız',  s3d: 'İnceleyin, gerekirse düzenleyin, onaylayın — veri workspace\'e kaydedilir',
    s4t: 'İstediğinizde geçin', s4d: 'Yapılandırılmış panele gidin, manuel düzenleyin, chat\'e dönün — her zaman senkron',
    ctaTitle: 'Karbon ayak iziniz bir konuşma kadar yakın.',
    ctaDesc:  'Eğitim gerekmez. Danışman gerekmez. Sadece konuşun.',
    ctaBtn:   'Ücretsiz Başla',
  },
};

const FEATURES = [
  { icon: Sparkles, key: 'feat1', color: 'text-[#75863B]', bg: 'bg-[#B4BE6A]/10' },
  { icon: BarChart3, key: 'feat2', color: 'text-sky-600',  bg: 'bg-sky-50' },
  { icon: FileText,  key: 'feat3', color: 'text-violet-600', bg: 'bg-violet-50' },
];

const HOW_STEPS = [
  { n: '01', key: 's1', color: 'bg-[#302817] text-[#B4BE6A]' },
  { n: '02', key: 's2', color: 'bg-[#302817] text-[#B4BE6A]' },
  { n: '03', key: 's3', color: 'bg-[#302817] text-[#B4BE6A]' },
  { n: '04', key: 's4', color: 'bg-[#302817] text-[#B4BE6A]' },
];

// ── Page ───────────────────────────────────────────────────────────────────────
export default function Home() {
  const { language: lang, changeLanguage } = useLanguage();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef(null);

  useEffect(() => {
    if (!showLangMenu) return;
    const onKey   = e => { if (e.key === 'Escape') setShowLangMenu(false); };
    const onClick = e => { if (langMenuRef.current && !langMenuRef.current.contains(e.target)) setShowLangMenu(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [showLangMenu]);

  const t = copy[lang] ?? copy['en'];

  return (
    <main className="relative min-h-screen bg-[#FAFAF8] text-[#302817] overflow-x-hidden">

      {/* ── Header ── */}
      <header className="relative z-20 mx-auto flex h-18 w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/carbonless.png" alt="CarbonIQ" width={48} height={48} className="h-10 w-10 sm:h-12 sm:w-12" />
          <span className="text-[19px] sm:text-[21px] font-bold tracking-tight text-[#302817]">CarbonIQ</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="relative" ref={langMenuRef}>
            <button
              onClick={() => setShowLangMenu(v => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#302817]/12 bg-white shadow-sm transition hover:border-[#B4BE6A]/40"
            >
              <Globe2 className="h-4 w-4 text-[#95A847]" />
            </button>
            {showLangMenu && (
              <div className="absolute right-0 top-full z-50 mt-2 w-36 overflow-hidden rounded-xl border border-[#302817]/10 bg-white shadow-xl">
                {['en', 'tr'].map(l => (
                  <button key={l} onClick={() => { changeLanguage(l); setShowLangMenu(false); }}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-xs font-bold transition hover:bg-[#F8F8F8] ${lang === l ? 'text-[#95A847]' : 'text-[#302817]/70'}`}>
                    {l === 'en' ? '🇬🇧 English' : '🇹🇷 Türkçe'} {lang === l && '✓'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link href="/login" className="hidden text-sm font-semibold text-[#302817]/60 transition hover:text-[#302817] sm:inline-flex">{t.login}</Link>
          <Link href="/register" className="rounded-full bg-[#302817] px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-black sm:px-5 sm:py-2.5">
            {t.register}
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12 lg:pt-16">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Left: copy */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#B4BE6A]/30 bg-[#B4BE6A]/8 px-4 py-1.5 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-[#75863B]" />
              <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#75863B]">{t.badge}</span>
            </div>

            {/* Headline */}
            <h1 className="text-[38px] sm:text-[44px] lg:text-[50px] font-bold leading-[1.08] tracking-[-0.04em] text-[#302817] mb-5">
              <span className="block">{t.title1}</span>
              <span className="block bg-gradient-to-r from-[#75863B] to-[#B4BE6A] bg-clip-text text-transparent">{t.title2}</span>
              <span className="block">{t.title3}</span>
            </h1>

            <p className="text-[15px] leading-[1.75] text-[#302817]/60 mb-8 max-w-lg">
              {t.desc}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#302817] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#302817]/20 transition hover:-translate-y-0.5 hover:bg-black">
                <Sparkles className="h-4 w-4 text-[#B4BE6A]" />
                {t.start}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#302817]/15 bg-white px-7 py-3.5 text-sm font-bold text-[#302817]/70 shadow-sm transition hover:border-[#B4BE6A]/40 hover:text-[#302817]">
                {t.demo}
              </Link>
            </div>

            {/* Trust line */}
            <p className="mt-5 flex items-center gap-2 text-[11px] text-[#302817]/35">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#95A847]" />
              ISO 14064-1 · DEFRA 2023 · IEA 2023 · GLEC v3
            </p>
          </div>

          {/* Right: live chat demo */}
          <div className="relative">
            {/* Glow behind demo */}
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-[#B4BE6A]/12 to-[#95A847]/6 blur-2xl pointer-events-none" />
            <div className="relative">
              <AnimatedChatDemo lang={lang} />
              {/* Label below */}
              <p className="mt-3 text-center text-[10.5px] font-semibold text-[#302817]/30 tracking-wide">
                {lang === 'tr' ? '↑ Canlı demo — gerçek AI hesaplaması' : '↑ Live demo — real AI calculation'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-white border-t border-b border-[#302817]/6 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-[9.5px] font-bold uppercase tracking-[0.2em] text-[#302817]/35 mb-2">{t.how}</p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {HOW_STEPS.map((step, i) => (
              <div key={i} className="relative flex flex-col gap-3">
                {/* Connector line (desktop) */}
                {i < HOW_STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-5 left-[calc(50%+20px)] right-[-50%] h-px bg-gradient-to-r from-[#302817]/15 to-transparent" />
                )}
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#302817]">
                  <span className="text-[11px] font-bold text-[#B4BE6A]">{step.n}</span>
                </div>
                <div>
                  <p className="text-[13.5px] font-bold text-[#302817]">{t[`${step.key}t`]}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#302817]/50">{t[`${step.key}d`]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, key, color, bg }) => (
            <div key={key} className="rounded-2xl border border-[#302817]/8 bg-white p-6 shadow-sm">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg} mb-4`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <p className="text-[14px] font-bold text-[#302817] mb-1.5">{t[`${key}t`]}</p>
              <p className="text-[12px] leading-relaxed text-[#302817]/50">{t[`${key}d`]}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-[#302817] px-8 py-12 text-center">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[#75863B]/10 to-[#B4BE6A]/15 pointer-events-none" />
          <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-[#B4BE6A]/10 to-transparent pointer-events-none" />

          <div className="relative">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8">
                <Leaf className="h-6 w-6 text-[#B4BE6A]" />
              </div>
            </div>
            <h2 className="text-[26px] sm:text-[32px] font-bold text-white leading-tight mb-3">
              {t.ctaTitle}
            </h2>
            <p className="text-[14px] text-white/50 mb-8">{t.ctaDesc}</p>
            <Link href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-[#B4BE6A] px-8 py-3.5 text-sm font-bold text-[#302817] shadow-lg transition hover:bg-[#C8D47A] hover:-translate-y-0.5">
              <Sparkles className="h-4 w-4" />
              {t.ctaBtn}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer links ── */}
      <div className="border-t border-[#302817]/6 py-5 text-center text-[11px] text-[#302817]/35">
        <Link href="/terms" className="font-semibold transition hover:text-[#95A847]">
          {lang === 'tr' ? 'Kullanım Koşulları' : 'Terms of Use'}
        </Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="font-semibold transition hover:text-[#95A847]">
          {lang === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}
        </Link>
      </div>
    </main>
  );
}
