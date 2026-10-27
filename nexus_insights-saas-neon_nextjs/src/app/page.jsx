'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Globe2, Leaf, Brain, Sparkles, BarChart3, Zap, TreePine, Factory, CloudSun, Wind, Flame, Droplets, Truck } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import HeroSection from '@/components/hero/HeroSection';

/* -- Laptop unfold — a 3D "opening" effect for the AI-section MacBook photo.
   The image starts folded back (rotateX near-flat, tipped away from the
   viewer and faded out) and, once it scrolls into view, swings up on a
   bottom hinge to face the user — reading like a laptop lid being opened.
   Because the asset is a single flat photo of an already-open MacBook, the
   whole image rotates as one piece (true screen/body separation would need
   two layered images). perspective on the wrapper gives the rotation real
   depth; transform-origin at the bottom is the hinge. Fires once via
   IntersectionObserver and is disabled for prefers-reduced-motion. */
function LaptopUnfold({ children, className = '' }) {
  const ref = useRef(null);
  // `open` drives the final resting state (laptop facing the viewer).
  // `reduced` means the user asked for reduced motion — we still SHOW the
  // laptop, we just skip the 3D rotation and only do a soft fade so nothing
  // ever gets stuck invisible, on any device or browser.
  const [open, setOpen] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setReduced(true);
      setOpen(true); // visible immediately, no rotation
      return;
    }

    const el = ref.current;

    // Browsers without IntersectionObserver (old Safari etc.): open now.
    if (!el || typeof IntersectionObserver === 'undefined') {
      setOpen(true);
      return;
    }

    // Safety net: if the observer never fires (element already on screen on
    // load, layout quirk on mobile, etc.) open anyway after a short delay so
    // the laptop can never get stuck folded/invisible.
    const fallback = setTimeout(() => setOpen(true), 1200);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          clearTimeout(fallback);
          setOpen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -5% 0px' }
    );
    observer.observe(el);
    return () => { clearTimeout(fallback); observer.disconnect(); };
  }, []);

  return (
    <div ref={ref} className={className} style={{ perspective: '1600px' }}>
      <div
        className="transition-all duration-[2000ms] will-change-transform"
        style={{
          transformOrigin: 'bottom center',
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          // Reduced-motion: no rotation, just make sure it's shown.
          transform: reduced ? 'none' : (open ? 'rotateX(0deg)' : 'rotateX(-72deg)'),
          opacity: open ? 1 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

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
        @media (prefers-reduced-motion: reduce) {
          .animate-float { animation: none; opacity: 1; }
        }
      `}} />

      <Header wide />

      <HeroSection />


      <section id="about" className="relative z-10 py-10 sm:py-14 bg-white">
        <Reveal className="mx-auto max-w-6xl px-4 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* Left: heading + short teaser */}
            <div>
              <h2 className="text-[26px] sm:text-[34px] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#072C0E]">
                {lang === 'tr' ? <>Biz <span className="text-[#2ABD41]">Kimiz?</span></> : <>About <span className="text-[#2ABD41]">Us</span></>}
              </h2>

              <div className="mt-6 sm:mt-8 space-y-4 text-[14px] sm:text-[15px] leading-[1.8] text-[#072C0E]/65 max-w-lg">
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
                className="mt-8 sm:mt-10 inline-flex items-center gap-2 rounded-full btn-dark px-8 py-3.5 text-[14px] font-bold transition">
                {lang === 'tr' ? 'Daha Fazla' : 'Learn More'}
              </Link>
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
                  {/* Fixed-size container ensures all images display at same dimensions */}
                  <div className="w-[176px] h-[320px] sm:w-[220px] sm:h-[440px] overflow-hidden rounded-[2rem] drop-shadow-2xl animate-float rotate-[6deg]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      id="about-phone-img"
                      data-idx="0"
                      src="/about-phone.png"
                      alt={lang === 'tr' ? 'Karbon ayak izi — telefonda' : 'Carbon footprint on a phone'}
                      className="w-full h-full object-cover object-top transition-all duration-300"
                    />
                  </div>
                </div>

                {/* playful mixed-tone typography — pulled up beside the
                    phone's lower half, constrained left so it stays on white
                    and never overlaps the phone image on the right */}
                <div className="relative z-10 -mt-10 sm:-mt-20 max-w-[52%] sm:max-w-[48%]">
                  <p className="text-[22px] sm:text-[30px] font-extrabold leading-none tracking-tight text-[#072C0E]/30">Hey!</p>
                  <p className="mt-1 text-[18px] sm:text-[22px] font-bold leading-tight tracking-tight text-[#072C0E]/45">
                    {lang === 'tr' ? 'Bugünkü' : "What's your"}
                  </p>
                  <p className="text-[22px] sm:text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-[#2ABD41]">
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
        </Reveal>
      </section>


      {/* -- AI Section (like Dinnect AI) -- */}
      <section id="ai" className="relative z-10 pt-10 sm:pt-14 pb-0 bg-white">
        <Reveal className="mx-auto max-w-6xl px-4 sm:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">

            {/* Left: Text */}
            <div>
              <h2 className="text-[26px] sm:text-[34px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#072C0E]">
                Carbonless <span className="text-[#2ABD41]">AI</span>
              </h2>
              <p className="mt-4 sm:mt-5 text-[14px] sm:text-[15px] leading-[1.8] text-[#072C0E]/55 max-w-md">
                {lang === 'tr'
                  ? 'Verilerinizi doğal dilde anlatın — AI saniyeler içinde emisyonlarınızı hesaplar, sınıflandırır ve denetime hazır rapor oluşturur. Tablo doldurmak tarihe karıştı.'
                  : 'Describe your data in plain language — the AI calculates, classifies, and builds audit-ready reports in seconds. Spreadsheets are history.'}
              </p>

              {/* CTA — link to AI page */}
              <Link href="/ai"
                className="mt-8 sm:mt-10 inline-flex items-center gap-2 rounded-full btn-dark px-8 py-3.5 text-[14px] font-bold transition">
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
                {/* Unfolds on scroll into view (3D lid-open effect) */}
                <LaptopUnfold className="relative">
                  <Image
                    src="/ai-laptop.png"
                    alt={lang === 'tr' ? 'Carbonless AI sohbet ekranı — MacBook üzerinde' : 'Carbonless AI chat on a MacBook'}
                    width={1402}
                    height={1122}
                    className="relative w-full h-auto object-contain drop-shadow-2xl transition-transform duration-500 ease-out hover:scale-[1.03] hover:-translate-y-1"
                    priority={false}
                  />
                </LaptopUnfold>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* cream → white blend before Pricing (Pricing's own gradient continues from white) */}
      <div aria-hidden className="h-8 sm:h-10 bg-gradient-to-b from-white to-white" />

      {/* -- Pricing Section — fades in from the white AI section above
             (gradient over the top padding) instead of a hard border cut -- */}
      <section id="pricing" className="relative z-10 py-10 sm:py-14 bg-gradient-to-b from-white via-[#F1FCF2] to-[#F1FCF2]">
        <Reveal className="mx-auto max-w-4xl px-4 sm:px-8">
          {/* Header */}
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-[24px] sm:text-[30px] font-extrabold tracking-[-0.02em] text-[#072C0E]">
              {lang === 'tr' ? 'Fiyatlandırma' : 'Pricing'}
            </h2>
            <p className="mt-2 sm:mt-3 text-[13px] sm:text-[15px] text-[#072C0E]/50">
              {lang === 'tr'
                ? 'Carbonless beta sürecinde — tüm özellikler şu an ücretsiz.'
                : 'Carbonless is in beta — every feature is free for now.'}
            </p>
          </div>

          {/* One plan: there is no paid tier or usage limit yet, so the page
              says so instead of showing prices and limits that don't apply. */}
          <div className="max-w-xl mx-auto">
            <div className="relative rounded-2xl border-2 border-[#2ABD41] bg-white p-5 sm:p-7 shadow-lg shadow-[#2ABD41]/5">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2ABD41] px-4 py-1 text-[10px] font-bold text-[#072C0E] uppercase tracking-wide">
                Beta
              </div>
              <div className="mb-5 sm:mb-6">
                <p className="text-[13px] sm:text-[14px] font-bold text-[#2ABD41]">{lang === 'tr' ? 'Ücretsiz' : 'Free'}</p>
                <p className="mt-2 text-[12px] sm:text-[13px] text-[#072C0E]/50">
                  {lang === 'tr'
                    ? 'Beta süresince kullanım sınırı yok. Ücretli planlar başlamadan önce kullanıcılarımıza haber vereceğiz.'
                    : 'No usage limits during the beta. We will let our users know before any paid plan starts.'}
                </p>
              </div>
              <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
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
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#2ABD41] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[12px] sm:text-[13px] text-[#072C0E]/65">{f}</span>
                  </div>
                ))}
              </div>
              <Link href="/register"
                className="block w-full rounded-full btn-primary py-2.5 sm:py-3 text-center text-[12px] sm:text-[13px] font-bold transition">
                {lang === 'tr' ? 'Ücretsiz Başla' : 'Get Started Free'}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* pale mint → white blend before FAQ */}
      <div aria-hidden className="h-8 sm:h-10 bg-gradient-to-b from-[#F1FCF2] to-white" />

      {/* -- FAQ — native <details>/<summary> so the accordion needs no JS
          state and stays accessible/keyboard-friendly for free. -- */}
      <section id="faq" className="relative z-10 py-10 sm:py-14 bg-white">
        <Reveal className="mx-auto max-w-3xl px-4 sm:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-[24px] sm:text-[30px] font-extrabold tracking-[-0.02em] text-[#072C0E]">
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
              <details key={i} className="group rounded-2xl border border-[#DEFAE1] bg-green-50 px-5 sm:px-6 open:bg-white open:shadow-md transition-colors">
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
        </Reveal>
      </section>

      {/* white → dark-green blend before the Footer — the biggest color jump
          on the page, so it gets more height + more eased stops than the
          other transitions to avoid a visible seam. */}
      <div aria-hidden className="h-px bg-green-100" />

      <Footer />
    </main>
  );
}
