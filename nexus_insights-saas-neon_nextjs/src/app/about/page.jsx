'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import NextLink from 'next/link';
import { ArrowRight, Leaf, Shield, BarChart3, Globe } from 'lucide-react';
import ArtVisual from '@/components/ArtVisual';

export default function AboutPage() {
  const { language } = useLanguage();
  const tr = language === 'tr';

  return (
    <div className="page-type bg-white text-[#072C0E] antialiased overflow-x-clip">
      <Header wide />
      <main>
        {/* Mission */}
        <section className="py-12 sm:py-20 lg:py-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div>
                <h1 className="lp-display mb-5 sm:mb-6">
                  {tr ? 'Misyonumuz' : 'Our Mission'}
                </h1>
                <p className="lp-text mb-4 sm:mb-5">
                  {tr
                    ? 'Carbonless, İstinye Üniversitesi IT Valley bünyesinde geliştirilen bir akademik karbon ayak izi hesaplama platformudur. Amacımız, şirketlerin sera gazı emisyonlarını ISO 14064-1 ve GHG Protocol standartlarına uygun şekilde ölçmelerini, raporlamalarını ve azaltmalarını sağlamaktır.'
                    : 'Carbonless is an academic carbon footprint calculation platform developed at İstinye University IT Valley. Our mission is to help companies measure, report, and reduce their greenhouse gas emissions in compliance with ISO 14064-1 and GHG Protocol standards.'}
                </p>
                <p className="lp-text">
                  {tr
                    ? 'Türkiye ve global emisyon faktörleri ile desteklenen sistemimiz, ISO 14064-1 doğrulanmış envanter, Defra 2024, IPCC 2019 ve ulusal veriler kullanmaktadır.'
                    : 'Our system is supported by Turkey and global emission factors, using ISO 14064-1 verified inventory data, Defra 2024, IPCC 2019, and national data sources.'}
                </p>
              </div>
              <div className="flex items-center justify-center">
                {/* public/aboutNEWW.png: 1024 x 1024, transparent. It fades in and rises once when it scrolls into
                    view, then floats gently (ArtVisual); reduced motion shows it still. */}
                <ArtVisual
                  src="/aboutNEWW.png"
                  natW={1024}
                  natH={1024}
                  cropLeft={0}
                  testId="mission-visual"
                  maskClass="eco-mask--mission"
                  sizes="(min-width: 1024px) 560px, 92vw"
                  className="max-w-[460px] sm:max-w-[540px] lg:max-w-none"
                  alt={tr ? 'Yeşil bir tesis: bacalardan ağaçlar büyüyor, çevresinde yeşil bir enerji akışı' : 'A green industrial site with trees growing from its chimneys, wrapped in a flow of green energy'}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Parent company */}
        <section className="py-12 sm:py-16 lg:py-24 bg-[#DEFAE1]/20">
          <div className="max-w-5xl mx-auto px-4 sm:px-8">
            <div className="text-center mb-8 sm:mb-10">
              <h2 className="lp-h2">
                {tr ? 'Carbonless Network\'ün Bir Parçasıyız' : 'Part of the Carbonless Network'}
              </h2>
            </div>
            <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5 lp-text-block text-center">
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
                className="btn btn-lg btn-dark transition-all"
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

