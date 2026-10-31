'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Globe2, Leaf, Brain, Sparkles, BarChart3, Zap, TreePine, Factory, CloudSun, Wind, Flame, Droplets, Truck } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from '@/components/hero/HeroSection';
import PhoneSlideshow from '@/components/PhoneSlideshow';
import LaptopOpen from '@/components/LaptopOpen';
import './landing.css';

/* -- Scroll reveal — wraps a section's content so it fades + slides up into
   view as the user scrolls to it, instead of just appearing instantly. Fires
   once (doesn't re-hide scrolling back up, which reads as jittery) and skips
   the animation entirely for prefers-reduced-motion, matching the pattern
   already used for the hero's other animations in this same file. */
function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}

/* -- Page -- */
export default function Home() {
  const { language: lang } = useLanguage();

  return (
    <main className="landing min-h-screen bg-white relative overflow-clip">

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
        @media (prefers-reduced-motion: reduce) {
          .animate-float { animation: none; opacity: 1; }
        }
      `}} />

      <Header wide />

      <HeroSection />


      <section id="about" className="lp-section bg-white">
        <Reveal className="lp-container">
          <div className="lp-split">

            {/* Left: heading + short teaser */}
            <div>
              <h2 className="lp-h2">
                {lang === 'tr' ? <>Biz <span className="lp-accent">Kimiz?</span></> : <>About <span className="lp-accent">Us</span></>}
              </h2>

              <div className="lp-copy mt-6">
                <p>
                  {lang === 'tr'
                    ? 'Karbonsuz bir gezegen için altyapı inşa ediyoruz. Karbon, ekonominin en kritik göstergesi haline geldi — ama yönetim araçları hâlâ dağınık.'
                    : 'We are building the infrastructure for a carbonless planet. Carbon has become the economy\'s most critical metric — yet management tools remain fragmented.'}
                </p>
                <p>
                  {lang === 'tr'
                    ? 'Carbonless, teknoloji ve şeffaflığı birleştirerek şirketlerin emisyonlarını ölçmesini, raporlamasını ve azaltmasını kolaylaştırır.'
                    : 'Carbonless combines technology and transparency to make it easy for companies to measure, report, and reduce their emissions.'}
                </p>
              </div>

              {/* CTA — links to full About page */}
              <Link href="/about"
                className="lp-cta btn btn-lg btn-primary-dark">
                {lang === 'tr' ? 'Daha Fazla' : 'Learn More'}
              </Link>
            </div>

            {/* Right: showcase card — a compact white card: the phone on a bold green stripe at the right, the playful
                typography beside it (vertically centred), a caption underneath. The stripe is part of the phone's column, so
                the phone always stands on it, and it runs up to the card's top edge. */}
            <div className="relative mx-auto w-full max-w-[420px] sm:max-w-[460px]">
              <div className="relative overflow-hidden rounded-[2rem] bg-white border border-[#DEFAE1] shadow-[0_16px_44px_rgba(7,44,14,0.09)] px-5 sm:px-8 pt-5 sm:pt-7 pb-4 sm:pb-5">
                <div className="relative flex items-center justify-between gap-2 sm:gap-4">
                  {/* playful mixed-tone typography, beside the phone (never over it) */}
                  <div className="relative z-10 min-w-0">
                    <p className="text-[22px] sm:text-[30px] font-extrabold leading-none tracking-tight text-[#072C0E]/60">Hey!</p>
                    <p className="mt-1 text-[18px] sm:text-[22px] font-bold leading-tight tracking-tight text-[#072C0E]/65">
                      {lang === 'tr' ? 'Bugünkü' : "What's your"}
                    </p>
                    <p className="text-[22px] sm:text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-[#1D9C31]">
                      {lang === 'tr' ? 'ayak izin ne?' : 'footprint today?'}
                    </p>
                  </div>

                  {/* phone mockup photo on its stripe — the screens change by themselves (see PhoneSlideshow) */}
                  <div className="relative shrink-0 select-none px-2 sm:px-3">
                    {/* bold vertical stripe running behind the phone, up to the card's top edge */}
                    <div className="absolute left-1/2 -top-5 sm:-top-7 -bottom-2 sm:-bottom-3 w-24 sm:w-36 -translate-x-1/2 bg-[#2ABD41] rounded-b-[2rem]" />
                    {/* Fixed-size container ensures all images display at same dimensions */}
                    <div className="relative shrink-0 w-[154px] h-[280px] sm:w-[192px] sm:h-[385px] overflow-hidden rounded-[2rem] drop-shadow-2xl animate-float rotate-[6deg]">
                      <PhoneSlideshow
                        images={['/about-phone.png', '/about-phone2.png', '/about-phone3.png', '/about-phone4.png']}
                        label={lang === 'tr' ? 'Karbon ayak izi — telefonda' : 'Carbon footprint on a phone'}
                        dotLabel={(n, total) => (lang === 'tr' ? `${n}. görseli göster (${total} görselden)` : `Show image ${n} of ${total}`)}
                        className="h-full w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* caption */}
                <p className="relative mt-5 sm:mt-6 text-center lp-small font-medium">
                  {lang === 'tr' ? 'Önemli olanı ölçelim' : "Let's measure what matters"}
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>


      {/* -- AI Section (like Dinnect AI) -- */}
      <section id="ai" className="lp-section lp-section--ai">
        <Reveal className="lp-container">
          <div className="lp-split">

            {/* Left: Text */}
            <div>
              <h2 className="lp-h2">
                Carbonless <span className="lp-accent">AI</span>
              </h2>
              <p className="lp-lead">
                {lang === 'tr'
                  ? 'Verilerinizi doğal dilde anlatın — AI saniyeler içinde emisyonlarınızı hesaplar, sınıflandırır ve denetime hazır rapor oluşturur. Tablo doldurmak tarihe karıştı.'
                  : 'Describe your data in plain language — the AI calculates, classifies, and builds audit-ready reports in seconds. Spreadsheets are history.'}
              </p>

              {/* CTA — link to AI page */}
              <Link href="/ai"
                className="lp-cta btn btn-lg btn-primary-dark">
                {lang === 'tr' ? 'Daha Fazla' : 'Learn More'}
              </Link>
            </div>

            {/* Right: MacBook mockup photo of the actual Carbonless AI chat
                (public/ai-laptop.png). Soft green glow behind it ties it into
                the palette. Its lid swings open once, slowly, when it first scrolls into view (LaptopOpen). */}
            <div className="relative flex items-center justify-center">
              <div className="relative w-full max-w-[560px]">
                <div className="absolute inset-8 rounded-full bg-[#2ABD41]/10 blur-3xl" />
                <LaptopOpen
                  className="relative"
                  src="/ai-laptop.png"
                  alt={lang === 'tr' ? 'Carbonless AI sohbet ekranı — MacBook üzerinde' : 'Carbonless AI chat on a MacBook'}
                />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* -- Pricing Section -- */}
      <section id="pricing" className="lp-section bg-white">
        <Reveal className="lp-container lp-container--md">
          {/* Header */}
          <div className="lp-head">
            <h2 className="lp-h2">
              {lang === 'tr' ? 'Fiyatlandırma' : 'Pricing'}
            </h2>
            <p className="lp-lead">
              {lang === 'tr'
                ? 'Carbonless beta sürecinde — tüm özellikler şu an ücretsiz.'
                : 'Carbonless is in beta — every feature is free for now.'}
            </p>
          </div>

          {/* One plan: there is no paid tier or usage limit yet, so the page
              says so instead of showing prices and limits that don't apply. */}
          <div className="max-w-xl mx-auto">
            <div className="lp-card lp-card--accent relative p-6 sm:p-8">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2ABD41] px-4 py-1 text-[11px] font-bold text-[#072C0E] uppercase tracking-[0.08em]">
                Beta
              </div>
              <div className="mb-6">
                <p className="lp-h3 text-green-700">{lang === 'tr' ? 'Ücretsiz' : 'Free'}</p>
                <p className="mt-2 lp-body">
                  {lang === 'tr'
                    ? 'Beta süresince kullanım sınırı yok. Ücretli planlar başlamadan önce kullanıcılarımıza haber vereceğiz.'
                    : 'No usage limits during the beta. We will let our users know before any paid plan starts.'}
                </p>
              </div>
              <div className="space-y-3 mb-8">
                {(lang === 'tr' ? [
                  'Dashboard ve AI ile veri girişi',
                  'Kapsam 1, 2 ve 3 emisyon hesaplama',
                  'ISO 14064-1 uyumlu PDF raporu',
                  'Adım adım karbon envanteri anketi',
                  'Hedefler ve ilerleme takibi',
                  'Ekip rolleri ve onay akışı',
                  'Excel/CSV dışa aktarma',
                ] : [
                  'Data entry on the dashboard and with AI',
                  'Scope 1, 2 and 3 emission calculations',
                  'ISO 14064-1 aligned PDF report',
                  'Step-by-step carbon inventory questionnaire',
                  'Goals and progress tracking',
                  'Team roles and approval flow',
                  'Excel/CSV export',
                ]).map(f => (
                  <div key={f} className="flex items-center gap-2.5">
                    <svg className="h-4 w-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="lp-body">{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/register"
                className="btn btn-lg btn-primary w-full">
                {lang === 'tr' ? 'Ücretsiz Başla' : 'Get Started Free'}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* -- FAQ — native <details>/<summary> so the accordion needs no JS
          state and stays accessible/keyboard-friendly for free. -- */}
      <section id="faq" className="lp-section lp-section--faq">
        <Reveal className="lp-container lp-container--sm">
          <div className="lp-head">
            <h2 className="lp-h2">
              {lang === 'tr' ? 'Sıkça sorulan sorular' : 'Frequently asked questions'}
            </h2>
            <p className="lp-lead">
              {lang === 'tr' ? 'Başka bir sorunuz mu var? Bize ulaşın.' : "Still have questions? We're happy to help."}
            </p>
          </div>

          <div className="space-y-3">
            {(lang === 'tr' ? [
              { q: 'Kapsam 1, 2 ve 3 emisyonları nedir?', a: 'Kapsam 1 doğrudan emisyonlarınızdır (kendi tesisleriniz, araçlarınız). Kapsam 2, satın aldığınız elektrik/ısıdan kaynaklanır. Kapsam 3 ise tedarik zinciriniz, iş seyahatleri ve ürün kullanımı gibi dolaylı emisyonları kapsar.' },
              { q: 'Kullanmak için teknik bilgi gerekiyor mu?', a: "Hayır. Verilerinizi kendi cümlelerinizle AI'a anlatmanız yeterli — CarbonIQ geri kalanını hesaplar ve sınıflandırır." },
              { q: 'Raporlar denetime hazır mı?', a: 'Raporlar ISO 14064-1 yapısına uygun hazırlanır: metodoloji, faktör kaynakları, kapsam ve kategori dağılımı. Anketi tamamlayıp verilerinizi ve kanıt belgelerinizi eklediğinizde raporu doğrulama için denetçinize teslim edebilirsiniz.' },
              { q: 'Ücret ödemem gerekiyor mu?', a: 'Hayır. Carbonless beta sürecinde ve tüm özellikler ücretsiz. Ücretli bir plan başlarsa önceden haber verilir; hesabınızı istediğiniz zaman silebilirsiniz.' },
              { q: 'Verilerim güvende mi?', a: 'Tüm veriler şifrelenir ve yalnızca sizin şirketiniz erişebilir. Verilerinizi asla üçüncü taraflarla paylaşmayız.' },
            ] : [
              { q: 'What are Scope 1, 2, and 3 emissions?', a: 'Scope 1 covers your direct emissions (owned facilities, vehicles). Scope 2 comes from the electricity or heat you purchase. Scope 3 covers indirect emissions across your supply chain, business travel, and product use.' },
              { q: 'Do I need technical knowledge to use Carbonless?', a: 'No. Just describe your data to the AI in plain language — CarbonIQ handles the calculation and classification for you.' },
              { q: 'Are the reports audit-ready?', a: 'Reports follow the ISO 14064-1 structure: methodology, factor sources, scope and category breakdown. Once you complete the questionnaire and add your data and evidence documents, you can hand the report to your auditor for verification.' },
              { q: 'Do I have to pay?', a: 'No. Carbonless is in beta and every feature is free. If a paid plan starts, you will be told in advance; you can delete your account at any time.' },
              { q: 'Is my data secure?', a: 'All data is encrypted and accessible only to your company. We never share your data with third parties.' },
            ]).map((item, i) => (
              <details key={i} className="lp-faq-item group">
                <summary>
                  {item.q}
                  <svg className="h-4 w-4 shrink-0 text-green-700 transition-transform duration-300 motion-reduce:transition-none group-open:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </summary>
                <p>
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      <Footer />
    </main>
  );
}
