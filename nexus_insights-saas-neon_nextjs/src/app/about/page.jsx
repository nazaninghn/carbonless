'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import NextLink from 'next/link';
import { ArrowRight, Leaf, Shield, BarChart3, Globe } from 'lucide-react';

export default function AboutPage() {
  const { language } = useLanguage();
  const tr = language === 'tr';

  return (
    <div className="bg-white text-[#072C0E] antialiased overflow-x-hidden">
      <Header wide />
      <main>
        {/* Mission */}
        <section className="py-12 sm:py-20 lg:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div>
                <h2 className="text-[28px] sm:text-[40px] lg:text-[56px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#072C0E] mb-5 sm:mb-6">
                  {tr ? 'Misyonumuz' : 'Our Mission'}
                </h2>
                <p className="text-[14px] sm:text-[15px] leading-[1.8] text-[#072C0E]/60 mb-4 sm:mb-6">
                  {tr
                    ? 'Carbonless, İstinye Üniversitesi IT Valley bünyesinde geliştirilen bir akademik karbon ayak izi hesaplama platformudur. Amacımız, şirketlerin sera gazı emisyonlarını ISO 14064-1 ve GHG Protocol standartlarına uygun şekilde ölçmelerini, raporlamalarını ve azaltmalarını sağlamaktır.'
                    : 'Carbonless is an academic carbon footprint calculation platform developed at İstinye University IT Valley. Our mission is to help companies measure, report, and reduce their greenhouse gas emissions in compliance with ISO 14064-1 and GHG Protocol standards.'}
                </p>
                <p className="text-[14px] sm:text-[15px] leading-[1.8] text-[#072C0E]/60">
                  {tr
                    ? 'Türkiye ve global emisyon faktörleri ile desteklenen sistemimiz, ATOM KABLO ISO 14064-1, Defra 2024, IPCC 2019 ve ulusal veriler kullanmaktadır.'
                    : 'Our system is supported by Turkey and global emission factors, using ATOM KABLO ISO 14064-1, Defra 2024, IPCC 2019, and national data sources.'}
                </p>
              </div>
              <div className="group flex items-center justify-center">
                <img src="/about-img.png" alt="About Carbonless" className="w-[240px] sm:w-[300px] lg:w-[380px] h-auto transition-all duration-700 ease-out group-hover:scale-[1.03] group-hover:-translate-y-2 animate-[float_4s_ease-in-out_infinite]" />
              </div>
            </div>
          </div>
        </section>

        {/* Parent company */}
        <section className="py-12 sm:py-16 lg:py-24 bg-[#DEFAE1]/20">
          <div className="max-w-5xl mx-auto px-4 sm:px-8">
            <div className="text-center mb-8 sm:mb-10">
              <h2 className="text-[26px] sm:text-[36px] lg:text-[40px] font-extrabold tracking-[-0.02em] text-[#072C0E]">
                {tr ? 'Carbonless Network\'ün Bir Parçasıyız' : 'Part of the Carbonless Network'}
              </h2>
            </div>
            <div className="max-w-3xl mx-auto space-y-4 sm:space-y-5 text-[14px] sm:text-[15px] leading-[1.8] text-[#072C0E]/65 text-center">
              <p>
                {tr
                  ? 'Carbonless Network, karbonsuz bir gezegen için işletim sistemini inşa ediyor. Karbon, modern ekonominin en kritik metriklerinden biri haline geldi — ancak bunu yönetecek altyapı hâlâ dağınık ve opak.'
                  : 'Carbonless Network is building the operating system for a carbonless planet. Carbon has become one of the most critical metrics of the modern economy — yet the infrastructure to manage it remains fragmented and opaque.'}
              </p>
              <p>
                {tr
                  ? 'Teknoloji, şeffaflık ve ağ etkilerini bir araya getirerek kuruluşların karbon etkisini sorunsuzca ölçmesini, yönetmesini ve ortadan kaldırmasını sağlıyoruz.'
                  : 'By combining technology, transparency, and network effects, we enable organizations to seamlessly measure, manage, and eliminate their carbon impact.'}
              </p>
              <p className="font-semibold text-[#072C0E]">
                {tr
                  ? 'Hedefimiz: Karbon görünürlüğünü evrensel, azaltmayı kaçınılmaz ve karbonsuz geleceği ölçeklenebilir kılmak.'
                  : 'Our goal: Make carbon visibility universal, reduction inevitable, and a carbonless future scalable.'}
              </p>
            </div>
            <div className="mt-8 sm:mt-10 text-center">
              <a
                href="https://www.carbonless.network/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#072C0E] text-white text-[14px] font-bold rounded-full hover:bg-[#175022] transition-all hover:-translate-y-0.5 shadow-lg"
              >
                carbonless.network
                <ArrowRight className="w-4 h-4" />
              </a>
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

