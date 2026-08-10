'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import NextLink from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function AiPage() {
  const { language } = useLanguage();
  const tr = language === 'tr';

  return (
    <div className="bg-white text-[#072C0E] antialiased overflow-x-hidden">
      <Header wide />
      <main>
        {/* Hero — two columns: text left, image right */}
        <section className="py-12 sm:py-16 lg:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              {/* Left: Text */}
              <div>
                <h1 className="text-[28px] sm:text-[40px] lg:text-[52px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#072C0E]">
                  Carbonless <span className="text-[#2ABD41]">AI</span>
                </h1>
                <div className="mt-6 sm:mt-8 space-y-4 text-[14px] sm:text-[15px] leading-[1.8] text-[#072C0E]/65 max-w-lg">
                  <p>
                    {tr
                      ? 'Carbonless AI, karbon hesaplama sürecini tamamen dönüştürür. Verilerinizi doğal dilde anlatın — AI emisyonlarınızı sınıflandırır, hesaplar ve raporlar.'
                      : 'Carbonless AI transforms carbon accounting. Describe your data in plain language — the AI classifies, calculates, and reports your emissions.'}
                  </p>
                  <p>
                    {tr
                      ? '188+ emisyon faktörü ile Scope 1, 2 ve 3 emisyonlarınızı saniyeler içinde ISO 14064-1 uyumlu rapora çevirir.'
                      : 'With 188+ emission factors, it converts your Scope 1, 2 & 3 emissions into ISO 14064-1 compliant reports in seconds.'}
                  </p>
                  <p>
                    {tr
                      ? 'Tablo yok, bekleme yok. Sadece konuşun, sonucu alın.'
                      : 'No spreadsheets, no waiting. Just talk, get results.'}
                  </p>
                </div>

                {/* Features list */}
                <div className="mt-8 space-y-3">
                  {(tr
                    ? ['Doğal dil ile veri girişi', 'Anlık emisyon hesaplama', 'ISO 14064-1 PDF raporu', 'Azaltma önerileri']
                    : ['Natural language data entry', 'Instant emission calculation', 'ISO 14064-1 PDF report', 'Reduction recommendations']
                  ).map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full bg-[#2ABD41]/10 flex items-center justify-center shrink-0">
                        <svg className="h-3 w-3 text-[#2ABD41]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-[14px] text-[#072C0E]/70 font-medium">{item}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
                  <NextLink href="/register" className="inline-flex items-center justify-center gap-2 bg-[#072C0E] text-white text-[14px] font-bold px-8 py-3.5 rounded-full hover:bg-[#175022] transition-all hover:-translate-y-0.5 shadow-lg">
                    {tr ? 'Ücretsiz Dene' : 'Try Free'}
                    <ArrowRight size={16} />
                  </NextLink>
                </div>
              </div>

              {/* Right: Image */}
              <div className="group flex items-center justify-center">
                <img src="/ai-img.png" alt="Carbonless AI" className="w-[280px] sm:w-[340px] lg:w-[420px] h-auto transition-all duration-700 ease-out group-hover:scale-[1.03] group-hover:-translate-y-2 animate-[float_4s_ease-in-out_infinite]" />
              </div>
            </div>
          </div>
        </section>
        {/* How it Works */}
        <section className="py-12 sm:py-16 lg:py-24 bg-[#F9FFF4]">
          <div className="max-w-6xl mx-auto px-4 sm:px-8">
            <div className="text-center mb-8 sm:mb-14">
              <h2 className="text-[26px] sm:text-[40px] font-extrabold tracking-[-0.02em] text-[#072C0E]">
                {tr ? 'Nasıl çalışır?' : 'How it works'}
              </h2>
              <p className="mt-2 sm:mt-3 text-[13px] sm:text-[15px] text-[#072C0E]/50">
                {tr ? 'Dört adımda, dakikalar içinde denetime hazır raporunuz.' : 'Four steps to an audit-ready report, in minutes.'}
              </p>
            </div>
            <div className="rounded-2xl border border-[#DEFAE1] bg-white p-5 sm:p-8">
              <div className="relative grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
                <div aria-hidden className="hidden lg:block absolute left-[12.5%] right-[12.5%] top-6 h-px bg-[#DEFAE1]" />
                {[
                  { num: '1', title: tr ? 'Verinizi anlatın' : 'Tell the AI', desc: tr ? 'Enerji, seyahat ya da satın alımlarınızı sade bir dille anlatın.' : 'Describe your energy use, travel, or purchases in plain language.' },
                  { num: '2', title: tr ? 'AI hesaplar' : 'AI calculates', desc: tr ? 'CarbonIQ, verinizi 188+ emisyon faktörüyle anında eşleştirir.' : 'CarbonIQ matches your data against 188+ emission factors instantly.' },
                  { num: '3', title: tr ? 'Raporunuzu alın' : 'Get your report', desc: tr ? 'ISO 14064-1 uyumlu, denetime hazır PDF raporu.' : 'An ISO 14064-1 compliant, audit-ready PDF report in seconds.' },
                  { num: '4', title: tr ? 'Hedef belirleyin' : 'Track & reduce', desc: tr ? 'Hedefler koyun, ilerlemenizi izleyin.' : 'Set targets, track progress, and watch your footprint shrink.' },
                ].map((step) => (
                  <div key={step.num} className="relative flex flex-col items-center text-center group cursor-pointer" onClick={(e) => { const el = e.currentTarget.querySelector('[data-detail]'); if (el) { el.classList.toggle('max-h-0'); el.classList.toggle('max-h-40'); el.classList.toggle('opacity-0'); el.classList.toggle('opacity-100'); el.classList.toggle('mt-0'); el.classList.toggle('mt-3'); } }}>
                    <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white border-2 border-[#2ABD41] text-[15px] font-bold text-[#2ABD41] shadow-sm transition-all duration-300 group-hover:bg-[#2ABD41] group-hover:text-white group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-[#2ABD41]/25">
                      {step.num}
                    </div>
                    <h3 className="mt-3 text-[15px] sm:text-[16px] font-bold text-[#072C0E] transition-colors group-hover:text-[#2ABD41]">{step.title}</h3>
                    <p className="mt-2 text-[13px] leading-[1.7] text-[#072C0E]/55 max-w-[220px]">{step.desc}</p>
                    <div data-detail className="max-h-0 opacity-0 mt-0 overflow-hidden transition-all duration-500 ease-in-out">
                      <div className="bg-[#F1FCF2] border border-[#DEFAE1] rounded-xl px-4 py-3 text-[12px] text-[#072C0E]/70 leading-[1.6]">
                        {step.num === '1' && (tr ? '💬 AI sohbet ekranına girin ve verilerinizi paylaşın' : '💬 Open AI chat and share your data naturally')}
                        {step.num === '2' && (tr ? '⚡ 188+ emisyon faktörü ile otomatik eşleştirme' : '⚡ Auto-matching with 188+ emission factors')}
                        {step.num === '3' && (tr ? '📄 PDF raporu saniyeler içinde hazır' : '📄 PDF report ready in seconds')}
                        {step.num === '4' && (tr ? '📊 Dashboard\'da hedeflerinizi takip edin' : '📊 Track your goals in the dashboard')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}} />
    </div>
  );
}
