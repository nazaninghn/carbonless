'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function TermsPage() {
  const { language } = useLanguage();
  const tr = language === 'tr';

  return (
    <div className="bg-white text-gray-900 antialiased min-h-screen">
      <Header />
      <main className="pt-24 lg:pt-40 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold mb-8">{tr ? 'Kullanım Koşulları' : 'Terms of Service'}</h1>
          <div className="prose prose-gray max-w-none space-y-6 text-gray-600">
            <p>{tr ? 'Son güncelleme: Nisan 2026' : 'Last updated: April 2026'}</p>

            <h2 className="text-xl font-semibold text-gray-900">{tr ? '1. Hizmet Tanımı' : '1. Service Description'}</h2>
            <p>{tr ? 'Carbonless, ISO 14064-1 standardına uygun karbon envanteri oluşturma, emisyon hesaplama ve raporlama hizmeti sunan bir SaaS platformudur.' : 'Carbonless is a SaaS platform providing carbon inventory creation, emission calculation, and reporting services compliant with ISO 14064-1.'}</p>

            <h2 className="text-xl font-semibold text-gray-900">{tr ? '2. Kullanıcı Sorumlulukları' : '2. User Responsibilities'}</h2>
            <p>{tr ? 'Kullanıcılar, girilen emisyon verilerinin doğruluğundan sorumludur. Platform, girilen verilere dayalı hesaplamalar yapar ve sonuçların doğruluğunu garanti etmez.' : 'Users are responsible for the accuracy of entered emission data. The platform performs calculations based on input data and does not guarantee result accuracy.'}</p>

            <h2 className="text-xl font-semibold text-gray-900">{tr ? '3. Emisyon Faktörleri' : '3. Emission Factors'}</h2>
            <p>{tr ? 'Platformda kullanılan emisyon faktörleri Defra 2024, IPCC 2019, ATOM KABLO ISO 14064-1 ve ulusal kaynaklardan alınmıştır. Faktörler periyodik olarak güncellenir.' : 'Emission factors used are sourced from Defra 2024, IPCC 2019, ATOM KABLO ISO 14064-1, and national sources. Factors are periodically updated.'}</p>

            <h2 className="text-xl font-semibold text-gray-900">{tr ? '4. Fikri Mülkiyet' : '4. Intellectual Property'}</h2>
            <p>{tr ? 'Platform ve içeriği IT Valley - İstinye Üniversitesi bünyesinde geliştirilmiştir. Tüm hakları saklıdır.' : 'The platform and its content were developed at IT Valley - İstinye University. All rights reserved.'}</p>

            <h2 className="text-xl font-semibold text-gray-900">{tr ? '5. İletişim' : '5. Contact'}</h2>
            <p>{tr ? 'Sorularınız için info@carbonless.com adresine e-posta gönderebilirsiniz.' : 'For questions, email info@carbonless.com.'}</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
