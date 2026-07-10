'use client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function PrivacyPage() {
  const { language } = useLanguage();
  const tr = language === 'tr';
  return (
    <div className="min-h-screen bg-[#F1FCF2] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-[#072C0E]/50 transition hover:text-[#072C0E]">
          <ArrowLeft className="h-4 w-4" /> {tr ? 'Ana Sayfaya Dön' : 'Back to Home'}
        </Link>

        <div className="rounded-[1.5rem] border border-[#072C0E]/10 bg-white/80 p-6 shadow-[0_8px_30px_rgba(7, 44, 14,0.06)] backdrop-blur-xl sm:p-10">
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#072C0E] sm:text-3xl">Privacy Policy</h1>
          <p className="mt-2 text-sm text-[#072C0E]/50">Last updated: May 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-7 text-[#072C0E]/70">
            <section>
              <h2 className="mb-2 text-base font-bold text-[#072C0E]">1. Information We Collect</h2>
              <p>We collect information you provide directly: account details (username, email), company information (legal name, tax number, sector), and emission data you enter into the platform.</p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold text-[#072C0E]">2. How We Use Your Information</h2>
              <p>Your data is used to: provide the carbon inventory service, generate ISO 14064-1 reports, calculate emissions, and improve platform functionality. We do not sell your data to third parties.</p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold text-[#072C0E]">3. Data Storage & Security</h2>
              <p>Your data is stored securely using industry-standard encryption. We use HTTPS for all communications, secure authentication tokens, and regular security audits to protect your information.</p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold text-[#072C0E]">4. Data Sharing</h2>
              <p>We do not share your emission data or company information with third parties unless: (a) you explicitly authorize it, (b) required by law, or (c) necessary to provide the service (e.g., hosting providers under strict data processing agreements).</p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold text-[#072C0E]">5. Cookies</h2>
              <p>We use essential cookies for authentication and session management. We do not use tracking cookies or third-party advertising cookies.</p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold text-[#072C0E]">6. Your Rights</h2>
              <p>You have the right to: access your data, export your data (JSON format available in Settings), correct inaccurate data, and delete your account and all associated data permanently.</p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold text-[#072C0E]">7. Data Retention</h2>
              <p>We retain your data for as long as your account is active. Upon account deletion, all personal data and emission records are permanently removed within 30 days.</p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold text-[#072C0E]">8. International Transfers</h2>
              <p>Your data may be processed in servers located in the European Union. We ensure appropriate safeguards are in place for any international data transfers.</p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold text-[#072C0E]">9. Changes to This Policy</h2>
              <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via email or platform notification.</p>
            </section>

            <section>
              <h2 className="mb-2 text-base font-bold text-[#072C0E]">10. Contact</h2>
              <p>For privacy-related inquiries, contact us at <span className="font-bold text-[#2ABD41]">privacy@carbonless.com</span></p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
