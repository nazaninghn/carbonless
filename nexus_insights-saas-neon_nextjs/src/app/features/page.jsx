'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import NextLink from 'next/link';
import {
  Leaf, BarChart3, FileText, MessageCircle, Shield, Globe,
  Target, TrendingDown, Upload, Bell, Settings, Users, CheckCircle
} from 'lucide-react';

export default function FeaturesPage() {
  const { language } = useLanguage();
  const tr = language === 'tr';

  const features = [
    { icon: Leaf, title: tr ? 'Scope 1/2/3 Emisyon Takibi' : 'Scope 1/2/3 Emission Tracking', desc: tr ? '131+ emisyon faktörü ile doğrudan, enerji dolaylı ve diğer dolaylı emisyonlarınızı hesaplayın.' : 'Calculate direct, energy indirect, and other indirect emissions with 131+ emission factors.' },
    { icon: MessageCircle, title: tr ? 'ISO 14064-1 Prsşname Sihirbazı' : 'ISO 14064-1 Questionnaire Wizard', desc: tr ? 'Chatbot ile envanter yapılandırmanızı 9 soruda belirleyin. Raporlama dönemi, baz yıl, faktör kaynağı ve daha fazlası.' : 'Configure your inventory in 9 questions via chatbot. Reporting period, base year, factor source and more.' },
    { icon: BarChart3, title: tr ? 'Görsel Dashboard' : 'Visual Dashboard', desc: tr ? 'Scope dağılımı, aylık trend, kategori kırılımı ile emisyonlarınızı anlık takip edin.' : 'Track emissions in real-time with scope distribution, monthly trends, and category breakdown.' },
    { icon: FileText, title: tr ? 'PDF ve CSV Raporlama' : 'PDF & CSV Reporting', desc: tr ? 'ISO 14064-1 uyumlu profesyonel raporlar. Türkçe ve İngilizce dil desteği.' : 'Professional ISO 14064-1 compliant reports. Turkish and English language support.' },
    { icon: Globe, title: tr ? 'Çoklu Ülke Desteği' : 'Multi-Country Support', desc: tr ? 'Türkiye (ATOM KABLO, ulusal veriler) ve Global (Defra, IPCC) emisyon faktörleri.' : 'Turkey (ATOM KABLO, national data) and Global (Defra, IPCC) emission factors.' },
    { icon: Target, title: tr ? 'Azaltma Hedefleri' : 'Reduction Targets', desc: tr ? 'Karbon azaltma hedeflerinizi belirleyin ve ilerlemenizi takip edin.' : 'Set carbon reduction targets and track your progress.' },
    { icon: TrendingDown, title: tr ? 'Yıl Karşılaştırma' : 'Year-over-Year Comparison', desc: tr ? 'Emisyonlarınızı yıllar arasında karşılaştırın ve trendleri analiz edin.' : 'Compare emissions across years and analyze trends.' },
    { icon: Upload, title: tr ? 'Toplu Veri İçe Aktarma' : 'Bulk Data Import', desc: tr ? 'CSV/JSON formatında toplu emisyon verisi yükleyin.' : 'Upload bulk emission data in CSV/JSON format.' },
    { icon: Shield, title: tr ? 'Özel Emisyon Talebi' : 'Custom Emission Requests', desc: tr ? 'Listede olmayan kaynaklar için özel talep gönderin, admin onaylasın.' : 'Submit custom requests for sources not in the list, admin reviews and approves.' },
    { icon: Bell, title: tr ? 'Bildirim Sistemi' : 'Notification System', desc: tr ? 'Talep onayları ve sistem bildirimleri ile her zaman güncel kalın.' : 'Stay updated with request approvals and system notifications.' },
    { icon: Users, title: tr ? 'Rol Tabanlı Erişim' : 'Role-Based Access', desc: tr ? 'Admin, yönetici, veri girişi ve denetçi rolleri ile güvenli erişim kontrolü.' : 'Secure access control with admin, manager, data entry, and auditor roles.' },
    { icon: Settings, title: tr ? 'Tesis Yönetimi' : 'Facility Management', desc: tr ? 'Birden fazla tesisinizi yönetin ve her biri için ayrı emisyon takibi yapın.' : 'Manage multiple facilities and track emissions for each separately.' },
  ];

  return (
    <div className="bg-white text-gray-900 antialiased overflow-x-hidden">
      <Header />
      <main>
        <section className="pt-24 lg:pt-40 pb-16 lg:pb-28 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-full mb-4">
                {tr ? 'Özellikler' : 'Features'}
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
                {tr ? 'Karbon Yönetimi İçin ' : 'Everything You Need for '}
                <span className="gradient-text">{tr ? 'Her Şey' : 'Carbon Management'}</span>
              </h1>
              <p className="text-lg text-gray-600">
                {tr ? 'ISO 14064-1 uyumlu karbon envanteri oluşturmak için ihtiyacınız olan tüm araçlar.' : 'All the tools you need to build an ISO 14064-1 compliant carbon inventory.'}
              </p>
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <f.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-gray-600 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Emission Factor Sources */}
        <section className="py-20 lg:py-28 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                {tr ? 'Emisyon Faktör Kaynakları' : 'Emission Factor Sources'}
              </h2>
              <p className="text-lg text-gray-600">
                {tr ? '131+ emisyon faktörü, güvenilir uluslararası ve ulusal kaynaklardan.' : '131+ emission factors from trusted international and national sources.'}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                'Defra/DESNZ 2024', 'IPCC 2006', 'IPCC 2019 + AR6 GWP',
                'ATOM KABLO ISO 14064-1', 'Turkey National Grid', 'Turkey Fleet 2025',
                'ICAO 2025', 'Generic/Estimated'
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-100">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm text-gray-700">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 lg:py-28 bg-gradient-to-r from-primary via-secondary to-accent">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              {tr ? 'Hemen Başlayın' : 'Get Started Now'}
            </h2>
            <p className="text-lg text-white/80 mb-8">
              {tr ? 'Ücretsiz hesap oluşturun ve karbon ayak izinizi ölçmeye başlayın.' : 'Create a free account and start measuring your carbon footprint.'}
            </p>
            <NextLink href="/register" className="inline-block px-8 py-4 bg-white text-primary font-semibold rounded-xl hover:bg-gray-100 transition-colors shadow-lg">
              {tr ? 'Ücretsiz Kayıt Ol' : 'Register Free'}
            </NextLink>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
