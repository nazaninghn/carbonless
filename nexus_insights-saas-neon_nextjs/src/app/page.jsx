'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Globe2, Leaf } from 'lucide-react';

const copy = {
  en: {
    login: 'Login',
    register: 'Register',
    badge: 'SMART CARBON PLATFORM',
    title1: 'Calculate your',
    title2: 'carbon footprint',
    title3: 'with AI',
    desc: 'Measure emissions, answer ISO-ready questions and generate clear carbon reports — all in one modern workspace.',
    start: 'Start Calculating',
    dashboard: 'View Dashboard',
  },
  tr: {
    login: 'Giriş',
    register: 'Kayıt Ol',
    badge: 'AKILLI KARBON PLATFORMU',
    title1: '',
    title2: 'Karbon ayak izinizi',
    title3: 'AI ile hesaplayın',
    desc: 'Emisyonları ölçün, ISO uyumlu soruları yanıtlayın ve net karbon raporları oluşturun — hepsi tek bir modern platformda.',
    start: 'Hesaplamaya Başla',
    dashboard: 'Paneli Gör',
  },
};

export default function Home() {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    const saved = localStorage.getItem('carbonless_lang');
    if (saved === 'tr' || saved === 'en') setLang(saved);
  }, []);

  const changeLang = (next) => {
    setLang(next);
    localStorage.setItem('carbonless_lang', next);
  };

  const t = copy[lang];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F9EFE5] text-[#302817]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(248,248,248,0.92),transparent_34%),radial-gradient(circle_at_30%_32%,rgba(127,135,144,0.14),transparent_30%),radial-gradient(circle_at_75%_22%,rgba(143,146,161,0.16),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-gradient-to-b from-white/75 via-[#F9EFE5]/45 to-[#F9EFE5]" />

      <header className="relative z-20 mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <img src="/carbonless.png" alt="Carbonless" className="h-8 w-8 sm:h-10 sm:w-10" />
          <span className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-[#302817]">Carbonless</span>
        </Link>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button onClick={() => changeLang(lang === 'en' ? 'tr' : 'en')} className="inline-flex items-center gap-1.5 rounded-full border border-[#8F92A1]/25 bg-white/55 px-3 py-2 text-xs font-bold text-[#302817] shadow-lg shadow-[#302817]/5 backdrop-blur-xl transition hover:border-[#8F92A1]/45 hover:bg-white/80">
            <Globe2 className="h-4 w-4 text-[#7F8790]" />{lang === 'en' ? 'TR' : 'EN'}
          </button>
          <Link href="/login" className="hidden text-sm font-bold text-[#302817]/70 transition hover:text-[#7F8790] sm:inline-flex">{t.login}</Link>
          <Link href="/register" className="rounded-full border border-[#302817]/15 bg-white/55 px-4 py-2.5 text-sm font-bold text-[#302817] shadow-xl shadow-[#302817]/10 backdrop-blur-xl transition hover:border-[#8F92A1]/40 hover:bg-[#302817] hover:text-[#F9EFE5] sm:px-6 sm:py-3">{t.register}</Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-6xl flex-col items-center justify-center px-4 pb-8 pt-0 text-center sm:px-6">
        <div className="relative mx-auto mb-5 w-fit sm:mb-6">
          <div className="absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8F92A1]/18 blur-[90px] sm:h-[360px] sm:w-[360px] lg:h-[430px] lg:w-[430px]" />
          <div className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7F8790]/12 blur-[70px] sm:h-[310px] sm:w-[310px] lg:h-[380px] lg:w-[380px]" />
          <img src="/carbon-hero.png" alt="Carbon molecule with green leaves" className="carbon-hero-float relative mx-auto w-[245px] drop-shadow-[0_32px_55px_rgba(48,40,23,0.16)] sm:w-[330px] md:w-[370px] lg:w-[420px]" />
        </div>

        <div className="mx-auto mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-[#8F92A1]/25 bg-white/55 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8F92A1] shadow-lg shadow-[#302817]/5 backdrop-blur-xl sm:mb-5 sm:text-xs">
          <Leaf className="h-4 w-4 shrink-0 text-[#7F8790]" /><span className="truncate">{t.badge}</span>
        </div>

        <h1 className="mx-auto max-w-5xl text-[42px] font-bold leading-[1.04] tracking-[-0.06em] text-[#302817] sm:text-5xl md:text-6xl lg:text-[64px]">
          {t.title1 && `${t.title1} `}
          <span className="bg-gradient-to-r from-[#7F8790] to-[#8F92A1] bg-clip-text text-transparent">{t.title2}</span>{' '}
          {t.title3}
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#302817]/65 sm:text-base">{t.desc}</p>

        <div className="mt-8 h-px w-20 mx-auto bg-gradient-to-r from-transparent via-[#8F92A1]/30 to-transparent" />

        <div className="mt-6 flex w-full flex-col items-center justify-center gap-3 sm:mt-8 sm:w-auto sm:flex-row">
          <Link href="/register" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#302817] px-7 py-3.5 text-sm font-bold text-[#F9EFE5] shadow-xl shadow-[#302817]/18 transition hover:-translate-y-0.5 hover:bg-black sm:w-auto">
            {t.start}<ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#8F92A1]/25 bg-white/55 px-7 py-3.5 text-sm font-bold text-[#7F8790] shadow-lg shadow-[#302817]/5 backdrop-blur-xl transition hover:bg-white/80 hover:text-[#302817] sm:w-auto">
            {t.dashboard}
          </Link>
        </div>
      </section>
    </main>
  );
}
