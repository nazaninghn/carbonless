'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, Globe2, Leaf, Sparkles, CheckCircle2, BarChart3, FileText,
  MessageSquare, LayoutGrid, Target, RefreshCw, Minus,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/* ── Demo conversation ─────────────────────────────────────────────────────── */
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
const TIMINGS      = [300, 2400, 5000, 7800, 9800, 12400];
const TYPING_BEFORE = 900;

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
  const [shown, setShown]   = useState(0);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const timers = [];
    setShown(0); setTyping(false);
    TIMINGS.forEach((t, i) => {
      const msg = DEMO_MSGS[i];
      if (msg.role === 'ai' || msg.role === 'card')
        timers.push(setTimeout(() => setTyping(true), t - TYPING_BEFORE));
      timers.push(setTimeout(() => { setTyping(false); setShown(i + 1); }, t));
    });
    timers.push(setTimeout(() => { setShown(0); setTyping(false); }, 17500));
    return () => timers.forEach(clearTimeout);
  }, [lang]);

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
      <div ref={scrollRef} className="h-[300px] overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
        {msgs.map((msg, i) => {
          if (msg.role === 'ai') return (
            <div key={i} className="flex gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#302817]">
                <Sparkles className="h-3 w-3 text-[#B4BE6A]" />
              </div>
              <div className="max-w-[82%] rounded-[15px] rounded-tl-sm border border-[#302817]/8 bg-white px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[#302817] shadow-sm">
                {tr ? msg.tr : msg.en}
              </div>
            </div>
          );
          if (msg.role === 'user') return (
            <div key={i} className="flex justify-end">
              <div className="max-w-[78%] rounded-[15px] rounded-tr-sm bg-[#302817] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-white">
                {tr ? msg.tr : msg.en}
              </div>
            </div>
          );
          if (msg.role === 'card') return (
            <div key={i} className={`rounded-xl border ${msg.border} ${msg.bg} p-3`}>
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div>
                  <span className={`text-[9px] font-bold uppercase border rounded-full px-1.5 py-0.5 ${msg.badge}`}>
                    {tr ? msg.scopeTr : msg.scopeEn}
                  </span>
                  <p className="text-[12.5px] font-bold text-[#302817] mt-1">{tr ? msg.catTr : msg.catEn}</p>
                  <p className="text-[10px] text-[#302817]/40 mt-0.5">{tr ? msg.detailTr : msg.detailEn}</p>
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
          return null;
        })}
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
      {/* Fake input */}
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

/* ── Copy ──────────────────────────────────────────────────────────────────── */
const copy = {
  en: {
    login: 'Login',
    register: 'Start Free',
    badge: 'ISO 14064-1 Compliant',
    title: 'Measure, understand and reduce your company\'s carbon footprint',
    desc: 'Build your carbon inventory with guided AI chatbot or expert dashboard. Generate ISO 14064-1 compliant reports. See your position with sector benchmarks.',
    start: 'Start Free',
    demo: 'View Dashboard',
    note: 'No credit card required · Basic features free',

    f1t: 'AI Guided Chatbot',   f1d: 'Step-by-step questions. ISO methodology automatic.',         f1badge: 'Pro',
    f2t: 'Expert Dashboard',    f2d: 'Category cards. Fast form entry. Switch modes anytime.',      f2badge: 'Free',
    f3t: 'Sector Benchmark',    f3d: 'NACE + employee-based anonymous comparison.',                 f3badge: 'Free',
    f4t: 'ISO 14064-1 Report',  f4d: 'Scope, justification, exclusions included. Audit-ready PDF.',f4badge: 'Pro',
    f5t: 'Goals & Progress',    f5d: 'SBTi or manual target. In-year trend tracking.',             f5badge: 'Pro',
    f6t: 'Annual Continuity',   f6d: 'Last year prefill. Trend analysis. Base year suggestion.',   f6badge: 'Free',

    pricingTitle: 'Simple pricing',
    freePlan: 'Free', freePlanPrice: '₺0', freePlanPer: '/ year',
    proPlan: 'Pro',   proPlanPrice: '₺X', proPlanPer: '/ year',
    freeFeatures:   ['Dashboard data entry', 'Basic emission calculation', 'Sector benchmark'],
    freeNoFeatures: ['AI Chatbot', 'ISO 14064-1 Report', 'Progress tracking'],
    proFeatures:    ['Everything in Free', 'AI Chatbot (guided mode)', 'ISO 14064-1 PDF report', 'Goals and progress', 'Consultant approval system', 'Reminder notifications'],
    freeCta: 'Start Free',
    proCta:  'Go Pro',

    p1: 'ISO 14064-1',    p1s: 'Fully compliant',
    p2: '133 questions',  p2s: 'Scope 1–2–3',
    p3: 'GDPR',           p3s: 'Compliant benchmark',
    p4: 'DEFRA·IEA·IPCC', p4s: 'International EF',

    chatTitle: 'Talk your carbon data to AI',
    chatDesc: 'Describe your emission sources and the AI calculates, organises and converts them into an ISO 14064-1 compliant report.',

    ctaTitle: 'Your carbon footprint is a conversation away.',
    ctaDesc: 'No training needed. No consultants. Just talk.',
    ctaBtn: 'Start Free',

    terms: 'Terms of Use', privacy: 'Privacy Policy',
  },
  tr: {
    login: 'Giriş Yap',
    register: 'Ücretsiz Başla',
    badge: 'ISO 14064-1 Uyumlu',
    title: 'Şirketinizin karbon ayak izini ölçün, anlayın, azaltın',
    desc: 'Rehberli AI chatbot veya uzman dashboard ile karbon envanterinizi oluşturun. ISO 14064-1 uyumlu rapor üretin. Sektör benchmarkıyla konumunuzu görün.',
    start: 'Ücretsiz Başla',
    demo: 'Paneli Gör',
    note: 'Kredi kartı gerekmez · Temel özellikler ücretsiz',

    f1t: 'AI Rehberli Chatbot',    f1d: 'Sorular adım adım. ISO metodolojisi otomatik.',           f1badge: 'Pro',
    f2t: 'Uzman Dashboard',        f2d: 'Kategori kartları. Hızlı form girişi. Her an mod geçişi.', f2badge: 'Ücretsiz',
    f3t: 'Sektör Benchmarkı',      f3d: 'NACE + çalışan bazlı anonim karşılaştırma.',              f3badge: 'Ücretsiz',
    f4t: 'ISO 14064-1 Raporu',     f4d: 'Kapsam, gerekçe, istisna dahil. Denetçiye hazır PDF.',    f4badge: 'Pro',
    f5t: 'Hedefler ve İlerleme',   f5d: 'SBTi veya manuel hedef. Yıl içi trend takibi.',           f5badge: 'Pro',
    f6t: 'Yıllık Süreklilik',      f6d: 'Geçen yıl prefill. Trend analizi. Baz yıl önerisi.',      f6badge: 'Ücretsiz',

    pricingTitle: 'Basit fiyatlandırma',
    freePlan: 'Ücretsiz', freePlanPrice: '₺0', freePlanPer: '/ yıl',
    proPlan: 'Pro',        proPlanPrice: '₺X', proPlanPer: '/ yıl',
    freeFeatures:   ['Dashboard veri girişi', 'Temel emisyon hesabı', 'Sektör benchmarkı'],
    freeNoFeatures: ['AI Chatbot', 'ISO 14064-1 Raporu', 'İlerleme takibi'],
    proFeatures:    ["Ücretsiz'deki her şey", 'AI Chatbot (rehberli mod)', 'ISO 14064-1 PDF raporu', 'Hedefler ve ilerleme', 'Danışman onay sistemi', 'Hatırlatma bildirimleri'],
    freeCta: 'Ücretsiz Başla',
    proCta:  "Pro'ya Geç",

    p1: 'ISO 14064-1',    p1s: 'Tam uyumlu',
    p2: '133 soru',       p2s: 'Kapsam 1–2–3',
    p3: 'GDPR',           p3s: 'Uyumlu benchmark',
    p4: 'DEFRA·IEA·IPCC', p4s: 'Uluslararası EF',

    chatTitle: 'AI ile karbon verilerinizi konuşun',
    chatDesc: 'Emisyon kaynaklarınızı anlatın, AI hesaplar, düzenler ve ISO 14064-1 uyumlu rapora dönüştürür.',

    ctaTitle: 'Karbon ayak iziniz bir konuşma kadar yakın.',
    ctaDesc: 'Eğitim gerekmez. Danışman gerekmez. Sadece konuşun.',
    ctaBtn: 'Ücretsiz Başla',

    terms: 'Kullanım Koşulları', privacy: 'Gizlilik Politikası',
  },
};

const FEATURES = [
  { icon: MessageSquare, key: 'f1', color: 'text-[#75863B]',   bg: 'bg-[#EEF3D8]', isPro: true  },
  { icon: LayoutGrid,    key: 'f2', color: 'text-[#95A847]',   bg: 'bg-[#EEF3D8]', isPro: false },
  { icon: BarChart3,     key: 'f3', color: 'text-sky-600',     bg: 'bg-sky-50',     isPro: false },
  { icon: FileText,      key: 'f4', color: 'text-violet-600',  bg: 'bg-violet-50',  isPro: true  },
  { icon: Target,        key: 'f5', color: 'text-amber-600',   bg: 'bg-amber-50',   isPro: true  },
  { icon: RefreshCw,     key: 'f6', color: 'text-[#75863B]',   bg: 'bg-[#EEF3D8]', isPro: false },
];

const PROOF = ['p1','p2','p3','p4'];

/* ── Page ──────────────────────────────────────────────────────────────────── */
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
      <header className="sticky top-0 z-20 border-b border-[#302817]/8 bg-[#FAFAF8]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/carbonless.png" alt="CarbonIQ" width={36} height={36} className="h-9 w-auto" />
            <span className="text-[17px] font-bold tracking-tight text-[#302817]">CarbonIQ</span>
          </Link>
          <div className="flex items-center gap-2">
            {/* Lang toggle */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setShowLangMenu(v => !v)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#302817]/10 bg-white text-[#302817]/50 hover:border-[#B4BE6A]/40 transition"
              >
                <Globe2 className="h-3.5 w-3.5" />
              </button>
              {showLangMenu && (
                <div className="absolute right-0 top-full z-50 mt-2 w-32 overflow-hidden rounded-xl border border-[#302817]/10 bg-white shadow-xl">
                  {['en', 'tr'].map(l => (
                    <button key={l} onClick={() => { changeLanguage(l); setShowLangMenu(false); }}
                      className={`flex w-full items-center gap-2 px-4 py-2.5 text-xs font-semibold transition hover:bg-[#FAFAF8] ${lang === l ? 'text-[#95A847]' : 'text-[#302817]/60'}`}>
                      {l === 'en' ? '🇬🇧 English' : '🇹🇷 Türkçe'} {lang === l && '✓'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link href="/login" className="hidden text-sm font-semibold text-[#302817]/55 hover:text-[#302817] transition sm:inline-flex">
              {t.login}
            </Link>
            <Link href="/register" className="rounded-lg bg-[#95A847] px-4 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-[#75863B] transition">
              {t.register}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-16 pb-14 text-center">
        <div className="mx-auto max-w-2xl px-5">
          {/* ISO badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#B4BE6A]/35 bg-[#EEF3D8] px-4 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[#95A847]" />
            <span className="text-[11px] font-semibold text-[#75863B]">{t.badge}</span>
          </div>
          {/* Title */}
          <h1 className="text-[30px] sm:text-[40px] font-bold leading-[1.18] tracking-[-0.02em] text-[#302817] mb-5">
            {t.title}
          </h1>
          {/* Subtitle */}
          <p className="text-[14px] sm:text-[15px] leading-[1.75] text-[#302817]/55 mb-8 max-w-xl mx-auto">
            {t.desc}
          </p>
          {/* CTAs */}
          <div className="flex justify-center gap-2.5 mb-4">
            <Link href="/register"
              className="rounded-lg bg-[#95A847] px-6 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-[#75863B] transition">
              {t.start}
            </Link>
            <Link href="/login"
              className="rounded-lg border border-[#302817]/12 bg-white px-6 py-2.5 text-[13px] font-semibold text-[#302817]/60 hover:border-[#302817]/25 hover:text-[#302817] transition">
              {t.demo}
            </Link>
          </div>
          {/* Note */}
          <p className="text-[11.5px] text-[#302817]/38">{t.note}</p>
        </div>
      </section>

      {/* ── 6 Feature cards ── */}
      <section className="border-t border-[#302817]/8 bg-white py-10">
        <div className="mx-auto max-w-5xl px-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, key, color, bg, isPro }) => (
              <div key={key} className="rounded-xl border border-[#302817]/8 p-4">
                <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-[18px] w-[18px] ${color}`} />
                </div>
                <p className="text-[13px] font-semibold text-[#302817] mb-1">{t[`${key}t`]}</p>
                <p className="text-[12px] leading-relaxed text-[#302817]/50 mb-3">{t[`${key}d`]}</p>
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                  isPro
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-[#EEF3D8] text-[#75863B]'
                }`}>
                  {t[`${key}badge`]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="border-t border-[#302817]/8 bg-[#FAFAF8] py-10">
        <div className="mx-auto max-w-2xl px-5">
          <p className="mb-6 text-center text-[13px] font-semibold text-[#302817]">{t.pricingTitle}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Free */}
            <div className="rounded-xl border border-[#302817]/10 bg-white p-5">
              <p className="text-[13px] font-semibold text-[#302817] mb-1">{t.freePlan}</p>
              <p className="text-[22px] font-bold text-[#302817] mb-5">
                {t.freePlanPrice}{' '}
                <span className="text-[13px] font-normal text-[#302817]/40">{t.freePlanPer}</span>
              </p>
              <div className="space-y-2.5 mb-5">
                {t.freeFeatures.map(f => (
                  <div key={f} className="flex items-center gap-2 text-[12px] text-[#302817]/65">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#95A847]" /> {f}
                  </div>
                ))}
                {t.freeNoFeatures.map(f => (
                  <div key={f} className="flex items-center gap-2 text-[12px] text-[#302817]/28">
                    <Minus className="h-3.5 w-3.5 shrink-0 text-[#302817]/18" /> {f}
                  </div>
                ))}
              </div>
              <Link href="/register"
                className="block w-full rounded-lg border border-[#302817]/12 py-2 text-center text-[13px] font-semibold text-[#302817]/50 hover:border-[#302817]/25 hover:text-[#302817] transition">
                {t.freeCta}
              </Link>
            </div>

            {/* Pro */}
            <div className="rounded-xl border-2 border-[#95A847] bg-white p-5">
              <p className="text-[13px] font-semibold text-[#75863B] mb-1">{t.proPlan}</p>
              <p className="text-[22px] font-bold text-[#302817] mb-5">
                {t.proPlanPrice}{' '}
                <span className="text-[13px] font-normal text-[#302817]/40">{t.proPlanPer}</span>
              </p>
              <div className="space-y-2.5 mb-5">
                {t.proFeatures.map(f => (
                  <div key={f} className="flex items-center gap-2 text-[12px] text-[#302817]/65">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#95A847]" /> {f}
                  </div>
                ))}
              </div>
              <Link href="/register"
                className="block w-full rounded-lg bg-[#95A847] py-2 text-center text-[13px] font-bold text-white hover:bg-[#75863B] transition">
                {t.proCta}
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── Proof strip ── */}
      <div className="border-t border-[#302817]/8 bg-white py-5">
        <div className="mx-auto max-w-3xl px-5">
          <div className="flex flex-wrap items-center justify-center gap-y-4">
            {PROOF.map((k, i) => (
              <div key={k} className="flex items-center">
                <div className="px-6 text-center">
                  <p className="text-[14px] font-bold text-[#302817]">{t[k]}</p>
                  <p className="text-[10.5px] text-[#302817]/40">{t[`${k}s`]}</p>
                </div>
                {i < PROOF.length - 1 && (
                  <div className="hidden sm:block h-8 w-px bg-[#302817]/10" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI Chat demo section ── */}
      <section className="border-t border-[#302817]/8 bg-[#FAFAF8] py-14">
        <div className="mx-auto max-w-5xl px-5">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#B4BE6A]/35 bg-[#EEF3D8] px-3.5 py-1">
                <MessageSquare className="h-3 w-3 text-[#75863B]" />
                <span className="text-[10px] font-semibold text-[#75863B] uppercase tracking-wide">AI Chatbot</span>
                <span className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold text-amber-700">Pro</span>
              </div>
              <h2 className="mb-4 text-[24px] sm:text-[30px] font-bold leading-tight text-[#302817]">
                {t.chatTitle}
              </h2>
              <p className="text-[13px] leading-relaxed text-[#302817]/55 mb-6">
                {t.chatDesc}
              </p>
              <Link href="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-[#302817] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-black transition">
                <Sparkles className="h-3.5 w-3.5 text-[#B4BE6A]" />
                {t.start}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-[#B4BE6A]/10 to-[#95A847]/5 blur-xl pointer-events-none" />
              <div className="relative">
                <AnimatedChatDemo lang={lang} />
                <p className="mt-2.5 text-center text-[10px] font-semibold text-[#302817]/30 tracking-wide">
                  {lang === 'tr' ? '↑ Canlı demo — gerçek AI hesaplaması' : '↑ Live demo — real AI calculation'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="bg-[#302817] py-14 text-center">
        <div className="mx-auto max-w-xl px-5">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/8">
              <Leaf className="h-6 w-6 text-[#B4BE6A]" />
            </div>
          </div>
          <h2 className="mb-3 text-[24px] sm:text-[30px] font-bold text-white leading-tight">{t.ctaTitle}</h2>
          <p className="mb-7 text-[13px] text-white/45">{t.ctaDesc}</p>
          <Link href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-[#95A847] px-7 py-3 text-[13px] font-bold text-white shadow-lg hover:bg-[#B4BE6A] transition">
            <Sparkles className="h-4 w-4" />
            {t.ctaBtn}
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <div className="border-t border-white/8 bg-[#302817] py-4 text-center text-[11px] text-white/30">
        <Link href="/terms" className="transition hover:text-white/60">{t.terms}</Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="transition hover:text-white/60">{t.privacy}</Link>
      </div>
    </main>
  );
}
