'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import NextLink from 'next/link';
import { ArrowRight, CheckCircle, Leaf, Shield, BarChart3, Globe, Target, Users } from 'lucide-react';

export default function AboutPage() {
  const { language } = useLanguage();
  const tr = language === 'tr';

  return (
    <div className="bg-white text-gray-900 antialiased overflow-x-hidden">
      <Header />
      <main>
        {/* Hero */}
        <section className="pt-24 lg:pt-40 pb-16 lg:pb-28 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-4">
                {tr ? 'Hakkımızda' : 'About Us'}
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                {tr ? 'Karbon Yönetimini ' : 'Making Carbon Management '}
                <span className="gradient-text">{tr ? 'Herkes İçin Erişilebilir' : 'Accessible to Everyone'}</span>
              </h1>
              <p className="text-lg text-gray-600">
                {tr
                  ? 'Carbonless, ISO 14064-1 standardına uygun karbon envanteri oluşturmayı kolaylaştıran bir SaaS platformudur.'
                  : 'Carbonless is a SaaS platform that simplifies creating carbon inventories compliant with ISO 14064-1.'}
              </p>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section className="py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                  {tr ? 'Misyonumuz' : 'Our Mission'}
                </h2>
                <p className="text-lg text-gray-600 mb-6">
                  {tr
                    ? 'Carbonless, İstinye Üniversitesi IT Valley bünyesinde geliştirilen bir akademik karbon ayak izi hesaplama platformudur. Amacımız, şirketlerin sera gazı emisyonlarını ISO 14064-1 ve GHG Protocol standartlarına uygun şekilde ölçmelerini, raporlamalarını ve azaltmalarını sağlamaktır.'
                    : 'Carbonless is an academic carbon footprint calculation platform developed at İstinye University IT Valley. Our mission is to help companies measure, report, and reduce their greenhouse gas emissions in compliance with ISO 14064-1 and GHG Protocol standards.'}
                </p>
                <p className="text-lg text-gray-600">
                  {tr
                    ? 'Türkiye ve global emisyon faktörleri ile desteklenen sistemimiz, ATOM KABLO ISO 14064-1, Defra 2024, IPCC 2019 ve ulusal veriler kullanmaktadır.'
                    : 'Our system is supported by Turkey and global emission factors, using ATOM KABLO ISO 14064-1, Defra 2024, IPCC 2019, and national data sources.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Leaf, val: 'ISO 14064-1', label: tr ? 'Uyumlu' : 'Compliant' },
                  { icon: BarChart3, val: '131+', label: tr ? 'Emisyon Faktörü' : 'Emission Factors' },
                  { icon: Globe, val: '2', label: tr ? 'Ülke Desteği' : 'Country Support' },
                  { icon: Shield, val: 'GHG', label: tr ? 'Protokol Uyumlu' : 'Protocol Compliant' },
                ].map((s, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-6 text-center">
                    <s.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                    <p className="text-2xl font-bold text-gray-900">{s.val}</p>
                    <p className="text-sm text-gray-600">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* What We Offer */}
        <section className="py-20 lg:py-28 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                {tr ? 'Neler Sunuyoruz' : 'What We Offer'}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: Target,
                  title: tr ? 'Karbon Envanteri' : 'Carbon Inventory',
                  desc: tr ? 'Scope 1, 2 ve 3 emisyonlarınızı ISO 14064-1 standardına uygun olarak hesaplayın ve raporlayın.' : 'Calculate and report your Scope 1, 2, and 3 emissions in compliance with ISO 14064-1.',
                },
                {
                  icon: BarChart3,
                  title: tr ? 'Akıllı Raporlama' : 'Smart Reporting',
                  desc: tr ? 'PDF ve CSV formatında profesyonel raporlar oluşturun. Türkçe ve İngilizce dil desteği.' : 'Generate professional reports in PDF and CSV. Turkish and English language support.',
                },
                {
                  icon: Users,
                  title: tr ? 'Prsşname Sihirbazı' : 'Questionnaire Wizard',
                  desc: tr ? 'ISO 14064-1 uyumlu chatbot ile envanter yapılandırmanızı kolayca belirleyin.' : 'Easily configure your inventory setup with our ISO 14064-1 compliant chatbot wizard.',
                },
              ].map((f, i) => (
                <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                  <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                    <f.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{f.title}</h3>
                  <p className="text-gray-600">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Standards */}
        <section className="py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                {tr ? 'Desteklenen Standartlar ve Kaynaklar' : 'Supported Standards & Sources'}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: 'ISO 14064-1:2018', desc: tr ? 'Sera gazı envanteri standardı' : 'GHG inventory standard' },
                { name: 'GHG Protocol', desc: tr ? 'Kurumsal standart' : 'Corporate standard' },
                { name: 'Defra/DESNZ 2024', desc: tr ? 'UK dönüşüm faktörleri' : 'UK conversion factors' },
                { name: 'IPCC 2019 + AR6', desc: tr ? 'Küresel ısınma potansiyeli' : 'Global warming potential' },
                { name: 'ATOM KABLO', desc: tr ? 'ISO 14064-1 proje verileri' : 'ISO 14064-1 project data' },
                { name: 'ICAO 2025', desc: tr ? 'Havacılık emisyonları' : 'Aviation emissions' },
                { name: 'Turkey National', desc: tr ? 'Ulusal enerji verileri' : 'National energy data' },
                { name: 'Turkey Fleet 2025', desc: tr ? 'Araç filosu verileri' : 'Vehicle fleet data' },
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 lg:py-28 bg-gradient-to-r from-primary via-secondary to-accent">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              {tr ? 'Karbon Ayak İzinizi Ölçmeye Başlayın' : 'Start Measuring Your Carbon Footprint'}
            </h2>
            <p className="text-lg text-white/80 mb-8">
              {tr ? 'Ücretsiz hesap oluşturun ve ISO 14064-1 uyumlu karbon envanterinizi oluşturmaya başlayın.' : 'Create a free account and start building your ISO 14064-1 compliant carbon inventory.'}
            </p>
            <NextLink href="/register" className="inline-block px-8 py-4 bg-white text-primary font-semibold rounded-xl hover:bg-gray-100 transition-colors shadow-lg">
              {tr ? 'Ücretsiz Başla' : 'Get Started Free'}
            </NextLink>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
