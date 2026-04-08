'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function PrivacyPage() {
  const { language } = useLanguage();
  const tr = language === 'tr';

  return (
    <div className="bg-white text-gray-900 antialiased min-h-screen">
      <Header />
      <main className="pt-24 lg:pt-40 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold mb-8">{tr ? 'Gizlilik Politikası' : 'Privacy Policy'}</h1>
          <div className="prose prose-gray max-w-none space-y-6 text-gray-600">
            <p>{tr ? 'Son güncelleme: Nisan 2026' : 'Last updated: April 2026'}</p>

            <h2 className="text-xl font-semibold text-gray-900">{tr ? '1. Toplanan Veriler' : '1. Data We Collect'}</h2>
            <p>{tr ? 'Carbonless platformu, hesap oluşturma sırasında kullanıcı adı, e-posta adresi ve şirket bilgilerini toplar. Emisyon verileri kullanıcı tarafından girilir ve güvenli şekilde saklanır.' : 'Carbonless collects username, email, and company information during registration. Emission data is entered by users and stored securely.'}</p>

            <h2 className="text-xl font-semibold text-gray-900">{tr ? '2. Verilerin Kullanımı' : '2. How We Use Data'}</h2>
            <p>{tr ? 'Toplanan veriler yalnızca karbon envanteri hesaplama, raporlama ve kullanıcı deneyimini iyileştirme amacıyla kullanılır. Verileriniz üçüncü taraflarla paylaşılmaz.' : 'Data is used solely for carbon inventory calculation, reporting, and improving user experience. Your data is not shared with third parties.'}</p>

            <h2 className="text-xl font-semibold text-gray-900">{tr ? '3. Veri Güvenliği' : '3. Data Security'}</h2>
            <p>{tr ? 'Tüm veriler şifreli bağlantılar (HTTPS) üzerinden iletilir. Şifreler hash\'lenerek saklanır. JWT token tabanlı kimlik doğrulama kullanılır.' : 'All data is transmitted over encrypted connections (HTTPS). Passwords are hashed. JWT token-based authentication is used.'}</p>

            <h2 className="text-xl font-semibold text-gray-900">{tr ? '4. Çerezler' : '4. Cookies'}</h2>
            <p>{tr ? 'Platform, oturum yönetimi ve dil tercihi için localStorage kullanır. Üçüncü taraf çerezleri kullanılmaz.' : 'The platform uses localStorage for session management and language preference. No third-party cookies are used.'}</p>

            <h2 className="text-xl font-semibold text-gray-900">{tr ? '5. İletişim' : '5. Contact'}</h2>
            <p>{tr ? 'Gizlilik ile ilgili sorularınız için info@carbonless.com adresine e-posta gönderebilirsiniz.' : 'For privacy-related questions, email info@carbonless.com.'}</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
