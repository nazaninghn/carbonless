'use client';
import LegalPage from '@/components/legal/LegalPage';

const CONTENT = {
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: September 2026',
    sections: [
      { h: 'Information We Collect', p: 'We collect information you provide directly: account details (username, email), company information (legal name, tax number, sector), and emission data you enter into the platform.' },
      { h: 'How We Use Your Information', p: 'Your data is used to: provide the carbon inventory service, generate ISO 14064-1 reports, calculate emissions, and improve platform functionality. We do not sell your data to third parties.' },
      { h: 'Data Storage & Security', p: 'Your data is stored securely using industry-standard encryption. We use HTTPS for all communications, secure authentication tokens, and regular security audits to protect your information.' },
      { h: 'Data Sharing', p: 'We do not share your emission data or company information with third parties unless: (a) you explicitly authorize it, (b) required by law, or (c) necessary to provide the service (e.g., hosting providers under strict data processing agreements).' },
      { h: 'Cookies', p: 'We use essential cookies for authentication and session management. We do not use tracking cookies or third-party advertising cookies.' },
      { h: 'Your Rights', p: 'You have the right to: access your data, export your data (Excel or JSON, in Settings → Data), correct inaccurate data, and delete your account.' },
      { h: 'Data Retention', p: "We retain your data for as long as your account is active. When you delete your account, your personal data is removed; companies of which you are the only member are deleted with their data, while records you entered in a company with other members stay with that company." },
      { h: 'International Transfers', p: 'Your data may be processed in servers located in the European Union. We ensure appropriate safeguards are in place for any international data transfers.' },
      { h: 'Changes to This Policy', p: 'We may update this Privacy Policy from time to time. We will notify you of significant changes via email or platform notification.' },
      { h: 'Contact', p: 'For privacy-related inquiries, contact us at', email: 'privacy@carbonless.info' },
    ],
  },
  tr: {
    title: 'Gizlilik Politikası',
    updated: 'Son güncelleme: Eylül 2026',
    sections: [
      { h: 'Topladığımız Bilgiler', p: 'Doğrudan sizin verdiğiniz bilgileri topluyoruz: hesap bilgileri (kullanıcı adı, e-posta), şirket bilgileri (ticari unvan, vergi numarası, sektör) ve platforma girdiğiniz emisyon verileri.' },
      { h: 'Bilgilerinizi Nasıl Kullanırız', p: 'Verileriniz şu amaçlarla kullanılır: karbon envanteri hizmetini sunmak, ISO 14064-1 raporları oluşturmak, emisyonları hesaplamak ve platformu geliştirmek. Verilerinizi üçüncü taraflara satmayız.' },
      { h: 'Veri Saklama ve Güvenlik', p: 'Verileriniz sektör standardı şifreleme ile güvenli şekilde saklanır. Tüm iletişimde HTTPS, güvenli kimlik doğrulama belirteçleri ve düzenli güvenlik denetimleri kullanırız.' },
      { h: 'Veri Paylaşımı', p: 'Emisyon verilerinizi veya şirket bilgilerinizi üçüncü taraflarla paylaşmayız; şu durumlar hariç: (a) açıkça izin vermeniz, (b) yasal zorunluluk, (c) hizmetin sunulması için gerekli olması (ör. sıkı veri işleme sözleşmeleri kapsamındaki barındırma sağlayıcıları).' },
      { h: 'Çerezler', p: 'Kimlik doğrulama ve oturum yönetimi için yalnızca zorunlu çerezler kullanırız. İzleme çerezi veya üçüncü taraf reklam çerezi kullanmayız.' },
      { h: 'Haklarınız', p: 'Verilerinize erişme, verilerinizi dışa aktarma (Ayarlar → Veri bölümünde Excel veya JSON), hatalı verileri düzeltme ve hesabınızı silme hakkına sahipsiniz.' },
      { h: 'Verilerin Saklanma Süresi', p: 'Verilerinizi hesabınız aktif olduğu sürece saklarız. Hesabınızı sildiğinizde kişisel verileriniz kaldırılır; tek üyesi olduğunuz şirketler verileriyle birlikte silinir, başka üyeleri olan bir şirkete girdiğiniz kayıtlar ise o şirkette kalır.' },
      { h: 'Yurt Dışına Aktarım', p: 'Verileriniz Avrupa Birliği’nde bulunan sunucularda işlenebilir. Yurt dışına yapılan her veri aktarımı için uygun güvenceleri sağlarız.' },
      { h: 'Bu Politikadaki Değişiklikler', p: 'Bu Gizlilik Politikası zaman zaman güncellenebilir. Önemli değişiklikleri e-posta veya platform bildirimiyle duyururuz.' },
      { h: 'İletişim', p: 'Gizlilikle ilgili sorularınız için bize yazın:', email: 'privacy@carbonless.info' },
    ],
  },
};

export default function PrivacyPage() {
  return <LegalPage content={CONTENT} />;
}
